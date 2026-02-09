'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./nonmoveController');

router.get('/', auth, controller.getAll);

module.exports = router;