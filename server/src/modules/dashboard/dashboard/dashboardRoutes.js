// src/modules/dashboard/dashboard/dashboardRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./dashboardController');

router.get('/', auth, controller.getAll);

module.exports = router;