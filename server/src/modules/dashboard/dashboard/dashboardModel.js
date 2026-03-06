// src/modules/dashboard/dashboard/dashboardModel.js
'use strict';

const db = require('../../../config/database');

async function getAll(startDate, endDate) {
  let sql = `
    SELECT 
        a.asset_code, a.asset_model, a.asset_detail, a.doc_no, a.asset_lot, a.asset_type, 
        a.asset_usedfor, a.asset_brand, a.asset_feature, a.partCode, a.asset_remark,
        a.asset_status, a.is_status, a.asset_origin, a.asset_destination, a.current_address,
        a.refID, a.scan_at, a.last_used, a.create_date, a.created_at, a.updated_at, a.updated_by,
        CONCAT(COALESCE(e.titlename_th, ''), COALESCE(e.firstname_th, ''), ' ', COALESCE(e.lastname_th, '')) AS updated_by_name,
        s1.G_NAME as asset_status_name, s1.G_DESCRIPT as asset_status_color,
        s2.G_NAME as is_status_name, s2.G_DESCRIPT as is_status_color
    FROM tb_asset_lists a
    LEFT JOIN employees e ON a.updated_by = e.employee_id
    LEFT JOIN tb_erp_status s1 ON a.asset_status = s1.G_CODE AND s1.G_USE = 'A1'
    LEFT JOIN tb_erp_status s2 ON a.is_status = s2.G_CODE AND s2.G_USE = 'A1'
    WHERE a.is_status != '99'
  `;

  const params = [];

  // กรองด้วยช่วงวันที่
  if (startDate && endDate) {
    sql += ` AND DATE(a.scan_at) BETWEEN ? AND ? `;
    params.push(startDate, endDate);
  } else if (startDate) {
    sql += ` AND DATE(a.scan_at) >= ? `;
    params.push(startDate);
  } else if (endDate) {
    sql += ` AND DATE(a.scan_at) <= ? `;
    params.push(endDate);
  }

  sql += ` ORDER BY a.updated_at DESC, a.asset_code ASC `;

  const [rows] = await db.query(sql, params);
  return rows;
}

module.exports = {
  getAll,
};