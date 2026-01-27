// src/modules/Smartpackage/systemOut/systemOutRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./systemOutController');

router.get('/list', auth, controller.getScannedList);     // ดึงตารางขวา
router.post('/scan', auth, controller.scanAsset);         // ยิง QR
router.post('/return', auth, controller.returnAssets);    // คืนคลัง
router.get('/dropdowns', auth, controller.getDropdowns);  // ดึง Zone

module.exports = router;