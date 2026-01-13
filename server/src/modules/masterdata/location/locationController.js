// src/modules/masterdata/location/locationController.js
'use strict';
const model = require('./locationModel');

// GET /api/location  (optional legacy)
async function getAll(_req, res, next) {
  try {
    const rows = await model.getAll();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/location/search
// params: q, page, pageSize
async function searchLocations(req, res, next) {
  try {
    const q = (req.query.q || '').toString();
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '20', 10);

    const result = await model.searchLocations(q, page, pageSize);

    res.json({
      success: true,
      data: result.rows,
      total: result.total,
      page,
      pageSize,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  searchLocations,
};
