// src/modules/registration/registerasset/registerassetRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./registerassetController');

router.get('/', auth, controller.getAll);
router.get('/options', auth, controller.getOptions);
router.get('/history/:assetCode', auth, controller.getHistory);
router.post('/', auth, controller.create);
router.patch('/print/:assetCode', auth, controller.updatePrintStatus);
router.patch('/cancel', auth, controller.cancelBulk);
router.delete('/:lot', auth, controller.deleteByLot);

module.exports = router;