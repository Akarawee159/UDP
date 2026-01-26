// src/modules/Smartpackage/systemOut/systemOutRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./systemOutController');

router.get('/', auth, controller.getAll);

module.exports = router;