'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./supplierController');

router.get('/', auth, controller.getAll);

// Route สำหรับ Check Duplicate (ต้องอยู่ก่อน /:code)
router.get('/check-duplicate', auth, controller.checkDuplicate);

router.get('/:code', auth, controller.getByCode);
router.post('/', auth, controller.create);
router.put('/:code', auth, controller.update);
router.delete('/:code', auth, controller.remove);

module.exports = router;