'use strict';

// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config();
const db = require('../../config/database');

/** ✅ ฟังก์ชันกลาง: ตรวจ JWT + ตรวจ token_version จาก DB */
async function verifyJwtAndTV(token) {
  if (!token) throw new Error('No token provided');

  const payload = await new Promise((resolve, reject) => {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => err ? reject(err) : resolve(decoded));
  });

  const [rows] = await db.query(
    'SELECT token_version FROM employees WHERE employee_id = ? LIMIT 1',
    [payload.employee_id]
  );
  const currentTv = rows.length ? Number(rows[0].token_version || 0) : null;
  const tokenTv = Number(payload.tv || 0);

  if (currentTv === null || tokenTv !== currentTv) {
    throw new Error('Token revoked');
  }
  return payload; // ใส่ลง req.user / socket.user ต่อได้
}

/** ✅ middleware เดิมสำหรับ REST */
async function auth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  try {
    req.user = await verifyJwtAndTV(token);
    next();
  } catch (e) {
    return res.status(401).json({ message: e.message || 'Unauthorized' });
  }
}

const DEFAULT_EXP = Number(process.env.PASSWORD_DEFAULT_EXPIRY_DAYS || 90);

async function auth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  try {
    const payload = await verifyJwtAndTV(token);

    // ✅ เพิ่มเช็กวันหมดอายุ/ต้องเปลี่ยนรหัส
    const [rows] = await db.query(
      'SELECT password_expires_at, must_change_password FROM employees WHERE employee_id = ? LIMIT 1',
      [payload.employee_id]
    );
    const exAt = rows?.[0]?.password_expires_at ? new Date(rows[0].password_expires_at) : null;
    const must = Number(rows?.[0]?.must_change_password || 0) === 1;
    const now = new Date();

    if (must || (exAt && exAt <= now)) {
      // แจ้งทุกแท็บของ user ทันที
      req.app.get('io')?.to(`emp:${payload.employee_id}`).emit('auth:password_expired', {
        reason: must ? 'force_change' : 'expired',
        default_expiry_days: DEFAULT_EXP,
        at: new Date().toISOString()
      });

      const resetToken = jwt.sign(
        { employee_id: payload.employee_id, username: payload.username, reason: 'password_expired' },
        process.env.REFRESH_SECRET,
        { expiresIn: '10m' }
      );
      return res.status(419).json({
        code: 'PASSWORD_EXPIRED',
        message: 'รหัสผ่านหมดอายุ/ถูกบังคับให้เปลี่ยน',
        resetToken,
        default_expiry_days: DEFAULT_EXP
      });
    }

    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ message: e.message || 'Unauthorized' });
  }
}

module.exports = auth;
module.exports.verifyJwtAndTV = verifyJwtAndTV;
