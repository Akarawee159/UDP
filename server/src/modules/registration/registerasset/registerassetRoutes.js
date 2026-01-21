// src/modules/registration/registerasset/registerassetRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./registerassetController');

router.get('/', auth, controller.getAll);
router.post('/', auth, controller.create);
router.patch('/print/:assetCode', auth, controller.updatePrintStatus); // Route สำหรับอัปเดตสถานะปริ้น
router.delete('/:lot', auth, controller.deleteByLot);

module.exports = router;