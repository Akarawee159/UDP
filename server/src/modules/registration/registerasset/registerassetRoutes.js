'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./registerassetController');

router.get('/', auth, controller.getAll);
router.get('/check-code', auth, controller.checkCode);
router.get('/:asset_id', auth, controller.getById);
router.post('/', auth, controller.create);
router.put('/:asset_id', auth, controller.update);
router.delete('/:asset_id', auth, controller.remove);

module.exports = router;