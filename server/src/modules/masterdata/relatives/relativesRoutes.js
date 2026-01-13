'use strict';
const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./relativesController');

// /api/relatives
router.post('/:employee_id', auth, controller.create);
router.get('/:employee_id', auth, controller.list);

// NEW: update & soft-delete
router.put('/:employee_id/:g_id', auth, controller.update);
router.delete('/:employee_id/:g_id', auth, controller.softDelete);

module.exports = router;
