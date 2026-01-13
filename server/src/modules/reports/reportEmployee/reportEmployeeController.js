'use strict';

const model = require('./reportEmployeeModel');

async function getAll(_req, res, next) {
  try {
    const rows = await model.getAll();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function search(req, res, next) {
  try {
    const filters = req.body; // Receive filters from frontend
    const rows = await model.search(filters);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function getLogByEmployeeId(req, res, next) {
  try {
    const { id } = req.params;
    const rows = await model.getLogByEmployeeId(id);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function getOptions(_req, res, next) {
  try {
    const options = await model.getOptions();
    res.json({ success: true, data: options });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  search,
  getOptions,
  getLogByEmployeeId
};