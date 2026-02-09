// src/modules/reports/nonmove/nonmoveController.js
'use strict';

const model = require('./nonmoveModel');

async function getAll(_req, res, next) {
  try {
    const rows = await model.getAll();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
};