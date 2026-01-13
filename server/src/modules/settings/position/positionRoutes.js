'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./positionController');

router.get('/', auth, controller.getAll);
router.get('/check-code', auth, controller.checkCode);

// ✅ เพิ่ม Route นี้ (ต้องอยู่ก่อน /:G_ID)
router.get('/department-codes', auth, controller.getDepartmentCodes);

router.get('/:G_ID', auth, controller.getById);
router.post('/', auth, controller.create);
router.put('/:G_ID', auth, controller.update);
router.delete('/:G_ID', auth, controller.remove);

module.exports = router;