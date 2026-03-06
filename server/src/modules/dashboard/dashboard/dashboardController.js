// src/modules/dashboard/dashboard/dashboardController.js
'use strict';

const model = require('./dashboardModel');

async function getAll(req, res, next) {
  try {
    const { startDate, endDate } = req.query; // รับค่า startDate และ endDate
    const rows = await model.getAll(startDate, endDate);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
};