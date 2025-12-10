import jwt from 'jsonwebtoken';
import db from '../config/database.js';

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token tidak ditemukan' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT id, name, email, plan, plan_expires_at, email_verified, whatsapp, whatsapp_verified FROM users WHERE id = ?').get(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User tidak ditemukan' });
    }

    if (user.plan === 'pro' && user.plan_expires_at) {
      const expiresAt = new Date(user.plan_expires_at);
      if (expiresAt < new Date()) {
        db.prepare('UPDATE users SET plan = ? WHERE id = ?').run('free', user.id);
        user.plan = 'free';
      }
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token tidak valid' });
  }
};

export const requirePro = (req, res, next) => {
  if (req.user.plan !== 'pro') {
    return res.status(403).json({ error: 'Fitur ini hanya untuk pengguna Pro' });
  }
  next();
};
