// src/modules/masterdata/location/locationRoutes.js
'use strict';
const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./locationController');

// GET /api/location/search?q=ลาดกระบัง&page=1&pageSize=20
router.get('/search', auth, controller.searchLocations);

// เดิม: ดึงข้อมูลทั้งหมด (เช่น provinces ทั้งหมด)
router.get('/', auth, controller.getAll);

module.exports = router;
