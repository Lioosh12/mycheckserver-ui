import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';
import { sendVerificationEmail } from '../services/emailService.js';
import { v4 as uuidv4 } from 'uuid';

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Semua field wajib diisi' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email sudah terdaftar' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = db.prepare(`
      INSERT INTO users (name, email, password) VALUES (?, ?, ?)
    `).run(name, email, hashedPassword);

    db.prepare(`
      INSERT INTO notification_settings (user_id) VALUES (?)
    `).run(result.lastInsertRowid);

    const verificationToken = jwt.sign(
      { userId: result.lastInsertRowid, type: 'email_verify' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await sendVerificationEmail(email, verificationToken);

    res.status(201).json({ 
      message: 'Registrasi berhasil! Silakan cek email untuk verifikasi.',
      userId: result.lastInsertRowid 
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Email atau password salah' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email atau password salah' });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login berhasil',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        planExpiresAt: user.plan_expires_at,
        emailVerified: !!user.email_verified,
        whatsapp: user.whatsapp,
        whatsappVerified: !!user.whatsapp_verified
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

export const getProfile = (req, res) => {
  try {
    const user = req.user;
    
    const serverCount = db.prepare('SELECT COUNT(*) as count FROM servers WHERE user_id = ?').get(user.id);
    
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        planExpiresAt: user.plan_expires_at,
        emailVerified: !!user.email_verified,
        whatsapp: user.whatsapp,
        whatsappVerified: !!user.whatsapp_verified
      },
      stats: {
        serverCount: serverCount.count,
        maxServers: user.plan === 'pro' ? 'unlimited' : 1
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.user.id;

    if (email && email !== req.user.email) {
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
      if (existingUser) {
        return res.status(400).json({ error: 'Email sudah digunakan' });
      }
    }

    db.prepare(`
      UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name || null, email || null, userId);

    const updatedUser = db.prepare('SELECT id, name, email, plan, email_verified FROM users WHERE id = ?').get(userId);

    res.json({ 
      message: 'Profil berhasil diperbarui',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        plan: updatedUser.plan,
        emailVerified: !!updatedUser.email_verified
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(userId);
    
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Password saat ini salah' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    db.prepare(`
      UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(hashedPassword, userId);

    res.json({ message: 'Password berhasil diperbarui' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

export const verifyEmail = (req, res) => {
  try {
    const { token } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'email_verify') {
      return res.status(400).json({ error: 'Token tidak valid' });
    }

    db.prepare(`
      UPDATE users SET email_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(decoded.userId);

    res.json({ message: 'Email berhasil diverifikasi' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Token sudah kadaluarsa' });
    }
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

export const deleteAccount = (req, res) => {
  try {
    const userId = req.user.id;

    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    res.json({ message: 'Akun berhasil dihapus' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};
