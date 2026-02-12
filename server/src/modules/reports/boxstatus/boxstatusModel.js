// src/modules/reports/boxstatus/boxstatusModel.js
'use strict';

const db = require('../../../config/database');

/** ดึงรายการทรัพย์สินทั้งหมด พร้อมชื่อพนักงานและสถานะ */
async function getAll() {
  const sql = `
    SELECT 
        a.asset_code, 
        a.asset_detail, 
        a.doc_no, 
        a.asset_lot, 
        a.asset_type, 
        a.asset_usedfor, 
        a.asset_brand, 
        a.asset_feature,
        a.partCode,
        a.asset_remark,
        a.asset_status,
        a.is_status,
        a.asset_origin,
        a.asset_destination,
        a.refID,
        a.scan_at,
        a.create_date,
        a.created_at,
        a.updated_at,
        a.updated_by,
        -- จอยชื่อพนักงานผู้แก้ไขล่าสุด
        CONCAT(COALESCE(e.titlename_th, ''), COALESCE(e.firstname_th, ''), ' ', COALESCE(e.lastname_th, '')) AS updated_by_name,
        
        -- จอยชื่อสถานะและสี (Asset Status)
        s1.G_NAME as asset_status_name,
        s1.G_DESCRIPT as asset_status_color,
        
        -- จอยชื่อสถานะและสี (Is Status)
        s2.G_NAME as is_status_name,
        s2.G_DESCRIPT as is_status_color

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

module.exports = {
  getAll,
};