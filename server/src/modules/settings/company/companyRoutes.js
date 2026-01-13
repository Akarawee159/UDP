'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./companyController');

/** แสดงข้อมูลทั้งหมด */
router.get('/', auth, controller.getAll);

// (ต้องอยู่ก่อน /:G_ID เพื่อไม่ให้ 'check-code' ถูกอ่านเป็น :G_ID)
router.get('/check-code', auth, controller.checkCode);

router.get('/:G_ID', auth, controller.getById);
router.post('/', auth, controller.create);
router.put('/:G_ID', auth, controller.update);
router.delete('/:G_ID', auth, controller.remove);

module.exports = router;