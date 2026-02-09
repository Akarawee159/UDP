// src/modules/reports/nonmove/nonmoveModel.js
'use strict';

const db = require('../../../config/database');

/** ดึงรายการโซนทั้งหมด */
async function getAll() {
  const sql = `
    SELECT G_ID, G_CODE, G_NAME
    FROM tb_location
    ORDER BY G_ID ASC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

module.exports = {
  getAll,
};