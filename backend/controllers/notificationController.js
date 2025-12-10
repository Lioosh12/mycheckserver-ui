import db from '../config/database.js';

export const getNotifications = (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, unreadOnly = false } = req.query;

    let query = `
      SELECT n.*, s.name as server_name 
      FROM notifications n
      LEFT JOIN servers s ON n.server_id = s.id
      WHERE n.user_id = ?
    `;
    
    if (unreadOnly === 'true') {
      query += ' AND n.read = 0';
    }
    
    query += ' ORDER BY n.created_at DESC LIMIT ?';

    const notifications = db.prepare(query).all(userId, parseInt(limit));

    const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0').get(userId);

    res.json({
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        serverName: n.server_name,
        read: !!n.read,
        createdAt: n.created_at
      })),
      unreadCount: unreadCount.count
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

export const markAsRead = (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = db.prepare('SELECT id FROM notifications WHERE id = ? AND user_id = ?').get(id, userId);
    if (!notification) {
      return res.status(404).json({ error: 'Notifikasi tidak ditemukan' });
    }

    db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);

    res.json({ message: 'Notifikasi ditandai sudah dibaca' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

export const markAllAsRead = (req, res) => {
  try {
    const userId = req.user.id;

    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(userId);

    res.json({ message: 'Semua notifikasi ditandai sudah dibaca' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

export const getNotificationSettings = (req, res) => {
  try {
    const userId = req.user.id;

    let settings = db.prepare('SELECT * FROM notification_settings WHERE user_id = ?').get(userId);
    
    if (!settings) {
      db.prepare('INSERT INTO notification_settings (user_id) VALUES (?)').run(userId);
      settings = db.prepare('SELECT * FROM notification_settings WHERE user_id = ?').get(userId);
    }

    res.json({
      serverDown: !!settings.server_down,
      slowResponse: !!settings.slow_response,
      dailySummary: !!settings.daily_summary,
      slowThreshold: settings.slow_threshold
    });
  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

export const updateNotificationSettings = (req, res) => {
  try {
    const userId = req.user.id;
    const { serverDown, slowResponse, dailySummary, slowThreshold } = req.body;

    db.prepare(`
      UPDATE notification_settings SET
        server_down = COALESCE(?, server_down),
        slow_response = COALESCE(?, slow_response),
        daily_summary = COALESCE(?, daily_summary),
        slow_threshold = COALESCE(?, slow_threshold),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(
      serverDown !== undefined ? (serverDown ? 1 : 0) : null,
      slowResponse !== undefined ? (slowResponse ? 1 : 0) : null,
      dailySummary !== undefined ? (dailySummary ? 1 : 0) : null,
      slowThreshold || null,
      userId
    );

    res.json({ message: 'Pengaturan notifikasi berhasil diperbarui' });
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

export const updateWhatsapp = (req, res) => {
  try {
    const { whatsapp } = req.body;
    const userId = req.user.id;

    if (req.user.plan !== 'pro') {
      return res.status(403).json({ error: 'Fitur WhatsApp hanya untuk pengguna Pro' });
    }

    db.prepare(`
      UPDATE users SET whatsapp = ?, whatsapp_verified = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(whatsapp, userId);

    res.json({ message: 'Nomor WhatsApp berhasil disimpan' });
  } catch (error) {
    console.error('Update whatsapp error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};
