'use strict';

const express = require('express');
const router = express.Router();
// const auth = require('../../../auth/middleware/authMiddleware'); // ⚠️ endpoint public ยังไม่ใช้
const controller = require('./forgotpasswordController');

/** Resource: /forgotpassword */

// 🔓 Public (หน้า ForgotPassword)
router.post('/request', controller.requestReset);
router.post('/check-status', controller.checkStatus);

// ✅ Protected (ใช้ JWT + ตรวจสิทธิ์ใน controller)
router.get('/admin/pending', controller.listPendingForAdmin);
router.post('/admin/ack', controller.acknowledgeRequest);

module.exports = router;
