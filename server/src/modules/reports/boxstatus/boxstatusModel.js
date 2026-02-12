// src/modules/reports/boxstatus/boxstatusModel.js
'use strict';

const db = require('../../../config/database');

/** ดึงรายการทรัพย์สินทั้งหมด พร้อมชื่อพนักงานและสถานะ */
async function getAll() {
  const sql = `
    SELECT 
        a.asset_code, a.asset_detail, a.doc_no, a.asset_lot, a.asset_type, 
        a.asset_usedfor, a.asset_brand, a.asset_feature, a.partCode, a.asset_remark,
        a.asset_status, a.is_status, a.asset_origin, a.asset_destination,
        a.refID, a.scan_at, a.last_used, a.create_date, a.created_at, a.updated_at, a.updated_by,
        CONCAT(COALESCE(e.titlename_th, ''), COALESCE(e.firstname_th, ''), ' ', COALESCE(e.lastname_th, '')) AS updated_by_name,
        s1.G_NAME as asset_status_name, s1.G_DESCRIPT as asset_status_color,
        s2.G_NAME as is_status_name, s2.G_DESCRIPT as is_status_color
    FROM tb_asset_lists a
    LEFT JOIN employees e ON a.updated_by = e.employee_id
    LEFT JOIN tb_erp_status s1 ON a.asset_status = s1.G_CODE AND s1.G_USE = 'A1'
    LEFT JOIN tb_erp_status s2 ON a.is_status = s2.G_CODE AND s2.G_USE = 'A1'
    WHERE a.is_status != '99'
    ORDER BY a.partCode ASC, a.asset_code ASC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

/** ดึงประวัติการแก้ไข (History) ตาม asset_code */
async function getHistory(assetCode) {
  // แก้ไข: JOIN tb_asset_lists (a) เพื่อดึง last_used และ scan_at ปัจจุบันมาแสดง
  const sql = `
    SELECT d.*, 
           s1.G_NAME as asset_status_name, s1.G_DESCRIPT as asset_status_color,
           s2.G_NAME as is_status_name, s2.G_DESCRIPT as is_status_color,
           CONCAT(COALESCE(e1.titlename_th, ''), COALESCE(e1.firstname_th, ''), ' ', COALESCE(e1.lastname_th, '')) as booking_created_by,
           CONCAT(COALESCE(e2.titlename_th, ''), COALESCE(e2.firstname_th, ''), ' ', COALESCE(e2.lastname_th, '')) as updated_by_name,
           d.refID as refID,
           a.last_used, -- ดึง last_used จากตารางหลัก
           a.scan_at,   -- ดึง scan_at จากตารางหลัก
           DATE_FORMAT(d.updated_at, '%Y-%m-%d') as create_date_formatted,
           DATE_FORMAT(d.updated_at, '%H:%i:%s') as create_time_formatted

    FROM tb_asset_lists_detail d
    LEFT JOIN tb_asset_lists a ON d.asset_code = a.asset_code -- JOIN ตารางหลัก
    LEFT JOIN tb_erp_status s1 ON d.asset_status = s1.G_CODE AND s1.G_USE = 'A1'
    LEFT JOIN tb_erp_status s2 ON d.is_status = s2.G_CODE AND s2.G_USE = 'A1'
    LEFT JOIN employees e1 ON d.created_by = e1.employee_id
    LEFT JOIN employees e2 ON d.updated_by = e2.employee_id
    
    WHERE d.asset_code = ?
    ORDER BY d.updated_at DESC, d.asset_action DESC
  `;

  const [rows] = await db.query(sql, [assetCode]);

  return rows.map(row => ({
    ...row,
    updated_by: row.updated_by_name || row.updated_by
  }));
}

module.exports = {
  getAll,
  getHistory,
};