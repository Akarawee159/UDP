// src/modules/reports/boxstatus/boxstatusModel.js
'use strict';

const db = require('../../../config/database');

/** ดึงรายการโซนทั้งหมด */
async function getAll() {
  const sql = `
    SELECT  asset_code, 
            asset_detail, 
            doc_no, 
            asset_lot, 
            asset_type, 
            asset_usedfor, 
            asset_brand, 
            asset_feature,
            partCode,
            asset_remark,
            asset_status,
            is_status
    FROM tb_asset_lists
    ORDER BY asset_code ASC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

module.exports = {
  getAll,
};