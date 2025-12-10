import db from '../config/database.js';
import { checkServer } from '../services/monitorService.js';

export const getServers = (req, res) => {
  try {
    const servers = db.prepare(`
      SELECT id, name, domain, interval, email_notif, whatsapp_notif, status, response_time, last_check, created_at
      FROM servers WHERE user_id = ? ORDER BY created_at DESC
    `).all(req.user.id);

    res.json({ servers });
  } catch (error) {
    console.error('Get servers error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

export const getServer = (req, res) => {
  try {
    const { id } = req.params;
    
    const server = db.prepare(`
      SELECT * FROM servers WHERE id = ? AND user_id = ?
    `).get(id, req.user.id);

    if (!server) {
      return res.status(404).json({ error: 'Server tidak ditemukan' });
    }

    const logs = db.prepare(`
      SELECT * FROM server_logs WHERE server_id = ? 
      ORDER BY created_at DESC LIMIT 50
    `).all(id);

    const uptimeData = db.prepare(`
      SELECT 
        strftime('%H:00', created_at) as hour,
        AVG(CASE WHEN status = 'up' THEN 100.0 ELSE 0.0 END) as uptime,
        AVG(response_time) as avg_response_time
      FROM server_logs 
      WHERE server_id = ? AND created_at >= datetime('now', '-24 hours')
      GROUP BY strftime('%H', created_at)
      ORDER BY hour
    `).all(id);

    res.json({ 
      server: {
        id: server.id,
        name: server.name,
        domain: server.domain,
        interval: server.interval,
        emailNotif: !!server.email_notif,
        whatsappNotif: !!server.whatsapp_notif,
        status: server.status,
        responseTime: server.response_time,
        lastCheck: server.last_check,
        createdAt: server.created_at
      },
      logs: logs.map(log => ({
        id: log.id,
        statusCode: log.status_code,
        responseTime: log.response_time,
        status: log.status,
        message: log.message,
        createdAt: log.created_at
      })),
      uptimeData 
    });
  } catch (error) {
    console.error('Get server error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

export const createServer = async (req, res) => {
  try {
    const { name, domain, interval = 5, emailNotif = true, whatsappNotif = false } = req.body;
    const userId = req.user.id;

    if (!name || !domain) {
      return res.status(400).json({ error: 'Nama dan domain wajib diisi' });
    }

    if (req.user.plan === 'free') {
      const serverCount = db.prepare('SELECT COUNT(*) as count FROM servers WHERE user_id = ?').get(userId);
      if (serverCount.count >= 1) {
        return res.status(403).json({ error: 'Paket Free hanya bisa menambah 1 server. Upgrade ke Pro untuk unlimited!' });
      }
      
      if (interval < 5) {
        return res.status(403).json({ error: 'Interval minimum untuk paket Free adalah 5 menit' });
      }
    }

    const result = db.prepare(`
      INSERT INTO servers (user_id, name, domain, interval, email_notif, whatsapp_notif)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, name, domain, interval, emailNotif ? 1 : 0, whatsappNotif ? 1 : 0);

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(result.lastInsertRowid);

    checkServer(server).catch(err => console.error('Initial check error:', err));

    res.status(201).json({ 
      message: 'Server berhasil ditambahkan',
      server: {
        id: server.id,
        name: server.name,
        domain: server.domain,
        interval: server.interval,
        emailNotif: !!server.email_notif,
        whatsappNotif: !!server.whatsapp_notif,
        status: server.status,
        responseTime: server.response_time
      }
    });
  } catch (error) {
    console.error('Create server error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

export const updateServer = (req, res) => {
  try {
    const { id } = req.params;
    const { name, domain, interval, emailNotif, whatsappNotif } = req.body;
    const userId = req.user.id;

    const server = db.prepare('SELECT * FROM servers WHERE id = ? AND user_id = ?').get(id, userId);
    if (!server) {
      return res.status(404).json({ error: 'Server tidak ditemukan' });
    }

    if (req.user.plan === 'free' && interval && interval < 5) {
      return res.status(403).json({ error: 'Interval minimum untuk paket Free adalah 5 menit' });
    }

    db.prepare(`
      UPDATE servers SET 
        name = COALESCE(?, name),
        domain = COALESCE(?, domain),
        interval = COALESCE(?, interval),
        email_notif = COALESCE(?, email_notif),
        whatsapp_notif = COALESCE(?, whatsapp_notif),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || null, 
      domain || null, 
      interval || null, 
      emailNotif !== undefined ? (emailNotif ? 1 : 0) : null,
      whatsappNotif !== undefined ? (whatsappNotif ? 1 : 0) : null,
      id
    );

    const updatedServer = db.prepare('SELECT * FROM servers WHERE id = ?').get(id);

    res.json({ 
      message: 'Server berhasil diperbarui',
      server: {
        id: updatedServer.id,
        name: updatedServer.name,
        domain: updatedServer.domain,
        interval: updatedServer.interval,
        emailNotif: !!updatedServer.email_notif,
        whatsappNotif: !!updatedServer.whatsapp_notif,
        status: updatedServer.status,
        responseTime: updatedServer.response_time
      }
    });
  } catch (error) {
    console.error('Update server error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

export const deleteServer = (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const server = db.prepare('SELECT id FROM servers WHERE id = ? AND user_id = ?').get(id, userId);
    if (!server) {
      return res.status(404).json({ error: 'Server tidak ditemukan' });
    }

    db.prepare('DELETE FROM servers WHERE id = ?').run(id);

    res.json({ message: 'Server berhasil dihapus' });
  } catch (error) {
    console.error('Delete server error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

export const checkServerNow = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const server = db.prepare('SELECT * FROM servers WHERE id = ? AND user_id = ?').get(id, userId);
    if (!server) {
      return res.status(404).json({ error: 'Server tidak ditemukan' });
    }

    const result = await checkServer(server);

    res.json({ 
      message: 'Check selesai',
      result 
    });
  } catch (error) {
    console.error('Check server error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};
