// src/modules/Smartpackage/systemOut/systemOutModel.js
'use strict';

const db = require('../../../config/database');

/** ดึงรายการสาขาทั้งหมด */
async function getAll() {
  const sql = `
    SELECT *
    FROM a_tb_aabbff
  `;
  const [rows] = await db.query(sql);
  return rows;
}

module.exports = {
  getAll,
};
