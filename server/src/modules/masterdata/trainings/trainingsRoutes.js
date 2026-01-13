'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./trainingsController');

// Helper routes
router.get('/options', auth, controller.getOptions);
router.get('/employees', auth, controller.getEmployees);

// Main routes
router.get('/', auth, controller.getAll);
router.post('/', auth, controller.create);
router.put('/:id', auth, controller.update);
router.delete('/:id', auth, controller.softDelete); // ✅ New Soft Delete Route

router.get('/:id/employees', auth, controller.getBookingEmployees);

module.exports = router;