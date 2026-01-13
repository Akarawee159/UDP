'use strict';
const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./workhistoryController');

// /api/workhistory
// อ่านรายละเอียด 1 รายการ (ต้องมาก่อน /:employee_id)
router.get('/detail/:id', auth, controller.detail);

// สร้าง & อ่านรายการทั้งหมดของพนักงาน
router.post('/:employee_id', auth, controller.create);
router.get('/:employee_id', auth, controller.list);

// อัปเดต & ลบแบบ soft delete
router.put('/:id', auth, controller.update);
router.delete('/:id', auth, controller.softDelete);

module.exports = router;
