'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./reportEmployeeController');

// ✅ dropdown options
router.get('/options', auth, controller.getOptions);

// ✅ search (multi conditions)
router.post('/search', auth, controller.search);

// ✅ NEW: Get Log by Employee ID
router.get('/log/:id', auth, controller.getLogByEmployeeId);

// ✅ get all report (no filters)
router.get('/', auth, controller.getAll);

module.exports = router;