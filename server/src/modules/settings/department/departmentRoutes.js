'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./departmentController');

/** แสดงข้อมูลทั้งหมด */
router.get('/', auth, controller.getAll);
router.get('/check-code', auth, controller.checkCode);

// ✅ เพิ่ม Route นี้
router.get('/branch-codes', auth, controller.getBranchCodes);

router.get('/:G_ID', auth, controller.getById);
router.post('/', auth, controller.create);
router.put('/:G_ID', auth, controller.update);
router.delete('/:G_ID', auth, controller.remove);

module.exports = router;