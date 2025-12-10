import db from '../config/database.js';
import { sendEmail } from './emailService.js';

const DAILY_REPORT_HOURS = [8, 14, 20]; // Kirim report jam 8 pagi, 2 siang, 8 malam

export const checkServer = async (server) => {
  const startTime = Date.now();
  let status = 'down';
  let statusCode = 0;
  let responseTime = 0;
  let message = '';

  try {
    const url = server.domain.startsWith('http') ? server.domain : `https://${server.domain}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeout);
    responseTime = Date.now() - startTime;
    statusCode = response.status;
    
    if (response.ok || response.status < 400) {
      status = 'up';
      message = 'Server responding normally';
    } else {
      status = 'down';
      message = `HTTP ${response.status}`;
    }
  } catch (error) {
    responseTime = Date.now() - startTime;
    status = 'down';
    message = error.name === 'AbortError' ? 'Connection timeout' : error.message;
  }

  db.prepare(`
    INSERT INTO server_logs (server_id, status_code, response_time, status, message)
    VALUES (?, ?, ?, ?, ?)
  `).run(server.id, statusCode, responseTime, status, message);

  const previousStatus = server.status;
  
  db.prepare(`
    UPDATE servers SET status = ?, response_time = ?, last_check = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, responseTime, server.id);

  if (previousStatus === 'up' && status === 'down') {
    await sendDownNotification(server);
  } else if (previousStatus === 'down' && status === 'up') {
    await sendUpNotification(server);
  }

  return { status, statusCode, responseTime, message };
};

const sendDownNotification = async (server) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(server.user_id);
  if (!user) return;

  db.prepare(`
    INSERT INTO notifications (user_id, server_id, type, title, message)
    VALUES (?, ?, ?, ?, ?)
  `).run(user.id, server.id, 'server_down', `Server ${server.name} DOWN!`, 
    `Server ${server.name} (${server.domain}) tidak dapat dijangkau.`);

  if (server.email_notif && user.email_verified) {
    await sendEmail(user.email, `⚠️ Server DOWN: ${server.name}`, `
      <h2>Server ${server.name} sedang DOWN!</h2>
      <p>Server Anda tidak dapat dijangkau:</p>
      <ul>
        <li><strong>Name:</strong> ${server.name}</li>
        <li><strong>Domain:</strong> ${server.domain}</li>
        <li><strong>Time:</strong> ${new Date().toISOString()}</li>
      </ul>
      <p>Segera periksa server Anda.</p>
    `);
  }
};

const sendUpNotification = async (server) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(server.user_id);
  if (!user) return;

  db.prepare(`
    INSERT INTO notifications (user_id, server_id, type, title, message)
    VALUES (?, ?, ?, ?, ?)
  `).run(user.id, server.id, 'server_up', `Server ${server.name} UP!`, 
    `Server ${server.name} (${server.domain}) sudah kembali online.`);

  if (server.email_notif && user.email_verified) {
    await sendEmail(user.email, `✅ Server UP: ${server.name}`, `
      <h2>Server ${server.name} sudah UP!</h2>
      <p>Server Anda sudah kembali online:</p>
      <ul>
        <li><strong>Name:</strong> ${server.name}</li>
        <li><strong>Domain:</strong> ${server.domain}</li>
        <li><strong>Time:</strong> ${new Date().toISOString()}</li>
      </ul>
    `);
  }
};

export const runMonitoringCycle = async () => {
  const now = new Date();
  const servers = db.prepare(`
    SELECT s.*, u.plan FROM servers s
    JOIN users u ON s.user_id = u.id
    WHERE (s.last_check IS NULL OR 
      datetime(s.last_check, '+' || s.interval || ' minutes') <= datetime('now'))
  `).all();

  for (const server of servers) {
    if (server.plan === 'free' && server.interval < 5) {
      continue;
    }
    
    try {
      await checkServer(server);
    } catch (error) {
      console.error(`Error checking server ${server.name}:`, error);
    }
  }

  // Check if it's time for daily status report
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  if (DAILY_REPORT_HOURS.includes(currentHour) && currentMinute === 0) {
    await sendDailyStatusReport();
  }
};

export const sendDailyStatusReport = async () => {
  console.log('Sending daily status report...');
  
  const users = db.prepare(`
    SELECT DISTINCT u.* FROM users u
    JOIN servers s ON s.user_id = u.id
    JOIN notification_settings ns ON ns.user_id = u.id
    WHERE ns.daily_summary = 1 OR u.plan = 'pro'
  `).all();

  for (const user of users) {
    const servers = db.prepare(`
      SELECT * FROM servers WHERE user_id = ?
    `).all(user.id);

    if (servers.length === 0) continue;

    const upServers = servers.filter(s => s.status === 'up');
    const downServers = servers.filter(s => s.status === 'down');

    const serverRows = servers.map(s => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${s.name}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${s.domain}</td>
        <td style="padding: 8px; border: 1px solid #ddd; color: ${s.status === 'up' ? 'green' : 'red'}; font-weight: bold;">
          ${s.status.toUpperCase()}
        </td>
        <td style="padding: 8px; border: 1px solid #ddd;">${s.response_time}ms</td>
      </tr>
    `).join('');

    const now = new Date();
    const timeStr = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    await sendEmail(user.email, `📊 Status Report - ${timeStr}`, `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">📊 Server Status Report</h2>
        <p style="color: #666;">Laporan status server Anda pada ${timeStr}</p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0;">Ringkasan</h3>
          <p style="margin: 5px 0;">
            <span style="color: green; font-weight: bold;">✅ UP: ${upServers.length}</span> | 
            <span style="color: red; font-weight: bold;">❌ DOWN: ${downServers.length}</span> | 
            Total: ${servers.length} server
          </p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background: #333; color: white;">
              <th style="padding: 10px; text-align: left;">Server</th>
              <th style="padding: 10px; text-align: left;">Domain</th>
              <th style="padding: 10px; text-align: left;">Status</th>
              <th style="padding: 10px; text-align: left;">Response</th>
            </tr>
          </thead>
          <tbody>
            ${serverRows}
          </tbody>
        </table>

        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          Email ini dikirim otomatis oleh MyCheckServer.<br>
          Anda menerima email ini 3x sehari (08:00, 14:00, 20:00 WIB).
        </p>
      </div>
    `);

    console.log(`Daily report sent to ${user.email}`);
  }
};

// Manual trigger for testing
export const sendTestEmail = async (userId) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return { error: 'User not found' };

  const servers = db.prepare('SELECT * FROM servers WHERE user_id = ?').all(userId);
  
  const upServers = servers.filter(s => s.status === 'up');
  const downServers = servers.filter(s => s.status === 'down');

  const serverRows = servers.map(s => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${s.name}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${s.domain}</td>
      <td style="padding: 8px; border: 1px solid #ddd; color: ${s.status === 'up' ? 'green' : 'red'}; font-weight: bold;">
        ${s.status.toUpperCase()}
      </td>
      <td style="padding: 8px; border: 1px solid #ddd;">${s.response_time || 0}ms</td>
    </tr>
  `).join('');

  const now = new Date();
  const timeStr = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

  const result = await sendEmail(user.email, `📊 Status Report - ${timeStr}`, `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">📊 Server Status Report</h2>
      <p style="color: #666;">Laporan status server Anda pada ${timeStr}</p>
      
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0;">Ringkasan</h3>
        <p style="margin: 5px 0;">
          <span style="color: green; font-weight: bold;">✅ UP: ${upServers.length}</span> | 
          <span style="color: red; font-weight: bold;">❌ DOWN: ${downServers.length}</span> | 
          Total: ${servers.length} server
        </p>
      </div>

      ${servers.length > 0 ? `
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background: #333; color: white;">
            <th style="padding: 10px; text-align: left;">Server</th>
            <th style="padding: 10px; text-align: left;">Domain</th>
            <th style="padding: 10px; text-align: left;">Status</th>
            <th style="padding: 10px; text-align: left;">Response</th>
          </tr>
        </thead>
        <tbody>
          ${serverRows}
        </tbody>
      </table>
      ` : '<p>Belum ada server yang dimonitor.</p>'}

      <p style="color: #999; font-size: 12px; margin-top: 30px;">
        Email ini dikirim otomatis oleh MyCheckServer.
      </p>
    </div>
  `);

  return { success: result, email: user.email };
};
