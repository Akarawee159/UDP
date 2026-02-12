// src/modules/reports/boxstatus/boxstatusRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./boxstatusController');

router.get('/', auth, controller.getAll);
router.get('/history/:code', auth, controller.getHistory); // เพิ่ม Route นี้

module.exports = router;