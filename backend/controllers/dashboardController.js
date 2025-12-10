import db from '../config/database.js';

export const getDashboardStats = (req, res) => {
  try {
    const userId = req.user.id;

    const totalServers = db.prepare('SELECT COUNT(*) as count FROM servers WHERE user_id = ?').get(userId);
    const upServers = db.prepare("SELECT COUNT(*) as count FROM servers WHERE user_id = ? AND status = 'up'").get(userId);
    const downServers = db.prepare("SELECT COUNT(*) as count FROM servers WHERE user_id = ? AND status = 'down'").get(userId);

    const uptimeData = db.prepare(`
      SELECT 
        strftime('%H:00', sl.created_at) as time,
        ROUND(AVG(CASE WHEN sl.status = 'up' THEN 100.0 ELSE 0.0 END), 1) as uptime
      FROM server_logs sl
      JOIN servers s ON sl.server_id = s.id
      WHERE s.user_id = ? AND sl.created_at >= datetime('now', '-24 hours')
      GROUP BY strftime('%H', sl.created_at)
      ORDER BY sl.created_at
    `).all(userId);

    const recentNotifications = db.prepare(`
      SELECT n.*, s.name as server_name
      FROM notifications n
      LEFT JOIN servers s ON n.server_id = s.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 5
    `).all(userId);

    res.json({
      stats: {
        totalServers: totalServers.count,
        upServers: upServers.count,
        downServers: downServers.count,
        plan: req.user.plan
      },
      uptimeData: uptimeData.length > 0 ? uptimeData : [
        { time: '00:00', uptime: 100 },
        { time: '04:00', uptime: 100 },
        { time: '08:00', uptime: 100 },
        { time: '12:00', uptime: 100 },
        { time: '16:00', uptime: 100 },
        { time: '20:00', uptime: 100 }
      ],
      recentNotifications: recentNotifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        serverName: n.server_name,
        createdAt: n.created_at
      }))
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};
