import db from '../config/database.js';
import { createTransaction, verifyNotification, checkTransactionStatus } from '../services/midtransService.js';
import { v4 as uuidv4 } from 'uuid';

const PRO_PLAN_PRICE = 99000;

export const createPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = `MCS-${Date.now()}-${uuidv4().substring(0, 8)}`;

    const transaction = await createTransaction(
      orderId,
      PRO_PLAN_PRICE,
      req.user,
      { id: 'pro-plan', name: 'Pro Plan - 1 Bulan' }
    );

    db.prepare(`
      INSERT INTO payments (user_id, order_id, amount, plan, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, orderId, PRO_PLAN_PRICE, 'pro', 'pending');

    res.json({
      orderId,
      token: transaction.token,
      redirectUrl: transaction.redirect_url,
      clientKey: process.env.MIDTRANS_CLIENT_KEY
    });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Gagal membuat pembayaran' });
  }
};

export const handleNotification = async (req, res) => {
  try {
    const notification = req.body;
    
    const statusResponse = await verifyNotification(notification);
    
    const orderId = statusResponse.order_id;
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;
    const transactionId = statusResponse.transaction_id;
    const paymentType = statusResponse.payment_type;

    const payment = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(orderId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    let status = 'pending';
    
    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      if (fraudStatus === 'accept' || !fraudStatus) {
        status = 'paid';
        
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);
        
        db.prepare(`
          UPDATE users SET plan = 'pro', plan_expires_at = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(expiresAt.toISOString(), payment.user_id);

        db.prepare(`
          INSERT INTO notifications (user_id, type, title, message)
          VALUES (?, ?, ?, ?)
        `).run(payment.user_id, 'payment_success', 'Pembayaran Berhasil!', 
          `Selamat! Akun Anda telah diupgrade ke Pro hingga ${expiresAt.toLocaleDateString('id-ID')}`);
      }
    } else if (transactionStatus === 'deny' || transactionStatus === 'cancel' || transactionStatus === 'expire') {
      status = 'failed';
    } else if (transactionStatus === 'pending') {
      status = 'pending';
    }

    db.prepare(`
      UPDATE payments SET 
        status = ?, 
        transaction_id = ?,
        payment_type = ?,
        midtrans_response = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ?
    `).run(status, transactionId, paymentType, JSON.stringify(statusResponse), orderId);

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Notification handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const checkPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const payment = db.prepare('SELECT * FROM payments WHERE order_id = ? AND user_id = ?').get(orderId, userId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment tidak ditemukan' });
    }

    if (payment.status === 'pending') {
      try {
        const midtransStatus = await checkTransactionStatus(orderId);
        
        let status = 'pending';
        if (midtransStatus.transaction_status === 'settlement' || midtransStatus.transaction_status === 'capture') {
          status = 'paid';
          
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 1);
          
          db.prepare(`
            UPDATE users SET plan = 'pro', plan_expires_at = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(expiresAt.toISOString(), userId);
        } else if (['deny', 'cancel', 'expire'].includes(midtransStatus.transaction_status)) {
          status = 'failed';
        }

        db.prepare(`
          UPDATE payments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?
        `).run(status, orderId);

        payment.status = status;
      } catch (e) {
        console.log('Could not check Midtrans status:', e.message);
      }
    }

    res.json({
      orderId: payment.order_id,
      amount: payment.amount,
      plan: payment.plan,
      status: payment.status,
      paymentType: payment.payment_type,
      createdAt: payment.created_at
    });
  } catch (error) {
    console.error('Check payment status error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

export const getPaymentHistory = (req, res) => {
  try {
    const userId = req.user.id;

    const payments = db.prepare(`
      SELECT order_id, amount, plan, status, payment_type, created_at
      FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
    `).all(userId);

    res.json({
      payments: payments.map(p => ({
        orderId: p.order_id,
        amount: p.amount,
        plan: p.plan,
        status: p.status,
        paymentType: p.payment_type,
        createdAt: p.created_at
      }))
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

export const confirmPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.user.id;

    const payment = db.prepare('SELECT * FROM payments WHERE order_id = ? AND user_id = ?').get(orderId, userId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment tidak ditemukan' });
    }

    if (payment.status === 'paid') {
      return res.json({ success: true, message: 'Payment sudah dikonfirmasi' });
    }

    try {
      const midtransStatus = await checkTransactionStatus(orderId);
      console.log('Midtrans status:', midtransStatus);
      
      if (midtransStatus.transaction_status === 'settlement' || midtransStatus.transaction_status === 'capture') {
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);
        
        db.prepare(`
          UPDATE users SET plan = 'pro', plan_expires_at = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(expiresAt.toISOString(), userId);

        db.prepare(`
          UPDATE payments SET status = 'paid', payment_type = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE order_id = ?
        `).run(midtransStatus.payment_type || 'unknown', orderId);

        db.prepare(`
          INSERT INTO notifications (user_id, type, title, message)
          VALUES (?, ?, ?, ?)
        `).run(userId, 'payment_success', 'Pembayaran Berhasil!', 
          `Selamat! Akun Anda telah diupgrade ke Pro hingga ${expiresAt.toLocaleDateString('id-ID')}`);

        return res.json({ success: true, message: 'Plan berhasil diupgrade ke Pro!' });
      } else {
        return res.json({ success: false, message: `Status: ${midtransStatus.transaction_status}` });
      }
    } catch (e) {
      console.error('Midtrans check error:', e);
      return res.status(500).json({ error: 'Gagal mengecek status pembayaran' });
    }
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};

export const getCurrentPlan = (req, res) => {
  try {
    const user = req.user;

    let daysRemaining = null;
    if (user.plan === 'pro' && user.plan_expires_at) {
      const expiresAt = new Date(user.plan_expires_at);
      const now = new Date();
      daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
    }

    const serverCount = db.prepare('SELECT COUNT(*) as count FROM servers WHERE user_id = ?').get(user.id);

    res.json({
      plan: user.plan,
      expiresAt: user.plan_expires_at,
      daysRemaining,
      limits: {
        maxServers: user.plan === 'pro' ? 'unlimited' : 1,
        currentServers: serverCount.count,
        minInterval: user.plan === 'pro' ? 1 : 5,
        logRetention: user.plan === 'pro' ? 30 : 7,
        whatsappNotif: user.plan === 'pro'
      }
    });
  } catch (error) {
    console.error('Get current plan error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};
