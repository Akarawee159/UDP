// src/modules/reports/boxstatus/boxstatusController.js
'use strict';

const model = require('./boxstatusModel');

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