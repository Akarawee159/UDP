'use strict';

const express = require('express');
const router = express.Router();
const authController = require('./authController');
const auth = require('../auth/middleware/authMiddleware'); // ✅ ใช้ตรวจสิทธิ

// 🔽 --- ป้องกันการโจมตีแบบ Brute-force --- 🔽
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { message: 'พยายามเข้าสู่ระบบมากเกินไป กรุณาลองอีกครั้งใน 15 นาที' },
  standardHeaders: true,
  legacyHeaders: false,
});
// 🔼 --- สิ้นสุดป้องกัน --- 🔼

router.post('/login', loginLimiter, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/verify', loginLimiter, authController.verifyPassword);

router.post('/password/change', auth, authController.changePassword);
router.post('/password/expired-change', authController.changeExpiredPassword);
router.get('/status', auth, authController.passwordStatus);

// ✅ [เพิ่มใหม่] Route สำหรับดึง Policy Days (Public) เพื่อแสดงใน ModalExpired
router.get('/password-policy', authController.getPasswordPolicy);

// ✅ เตะผู้ใช้: ล้างทุก session
router.post('/revoke-sessions', auth, authController.revokeSessionsForEmployee);
router.get('/ping', auth, authController.passwordStatus);

module.exports = router;