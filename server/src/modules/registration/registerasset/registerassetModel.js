// src/modules/registration/registerasset/registerassetModel.js
'use strict';

const db = require('../../../config/database');

// Helper: ดึงเวลาปัจจุบันเป็น Timezone Bangkok แบบ String (YYYY-MM-DD HH:mm:ss)
// เพื่อให้ Database บันทึกค่าตามนี้เป๊ะๆ ไม่แปลงกลับเป็น UTC
function getBangkokNow() {
  const dateStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" });
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const COLUMNS_LIST = `
  asset_code, asset_detail, asset_type, asset_date, doc_no, 
  asset_lot, asset_holder, asset_location, 
  asset_width, asset_width_unit, 
  asset_length, asset_length_unit, 
  asset_height, asset_height_unit, 
  asset_capacity, asset_capacity_unit, 
  asset_weight, asset_weight_unit, 
  asset_img, 
  asset_dmg_001, asset_dmg_002, asset_dmg_003, asset_dmg_004, asset_dmg_005, asset_dmg_006,
  asset_remark, asset_usedfor, asset_brand, asset_feature, asset_supplier_name, label_register, partCode, 
  print_status, asset_status, is_status, 
  create_date, created_by, created_at,
  updated_by, updated_at, asset_action
`;

/** ดึงรายการทั้งหมด พร้อม Join ตารางสถานะ */
async function getAll() {
  const sql = `
    SELECT a.*, 
           s1.G_NAME as asset_status_name, s1.G_DESCRIPT as asset_status_color,
           s2.G_NAME as is_status_name, s2.G_DESCRIPT as is_status_color
    FROM tb_asset_lists a
    LEFT JOIN tb_erp_status s1 ON a.asset_status = s1.G_CODE AND s1.G_USE = 'A1'
    LEFT JOIN tb_erp_status s2 ON a.is_status = s2.G_CODE AND s2.G_USE = 'A1'
    WHERE a.is_status != '99'
    ORDER BY a.asset_code ASC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

async function getLastLotNumber(dateStr) {
  const pattern = `LOT${dateStr}%`;
  const sql = `SELECT asset_lot FROM tb_asset_lists WHERE asset_lot LIKE ? ORDER BY asset_lot DESC LIMIT 1`;
  const [rows] = await db.query(sql, [pattern]);
  return rows.length > 0 ? rows[0].asset_lot : null;
}

async function getLastAssetCodeRunning(baseCode) {
  const pattern = `${baseCode}-%`;
  const sql = `SELECT asset_code FROM tb_asset_lists WHERE asset_code LIKE ? ORDER BY length(asset_code) DESC, asset_code DESC LIMIT 1`;
  const [rows] = await db.query(sql, [pattern]);
  return rows.length > 0 ? rows[0].asset_code : null;
}

async function getErpStatus(gUse, gCode) {
  const sql = `SELECT G_NAME, G_DESCRIPT FROM tb_erp_status WHERE G_USE = ? AND G_CODE = ? LIMIT 1`;
  const [rows] = await db.query(sql, [gUse, gCode]);
  return rows.length > 0 ? rows[0] : null;
}

/** * อัปเดตสถานะการพิมพ์ (+1) 
 * และบันทึก History ลง tb_asset_lists_detail (Action = 'print')
 */
async function incrementPrintStatus(assetCode, user) {
  const checkSql = `SELECT * FROM tb_asset_lists WHERE asset_code = ?`;
  const [rows] = await db.query(checkSql, [assetCode]);

  if (rows.length === 0) return null;
  const currentData = rows[0];

  let currentStatus = parseInt(currentData.print_status);
  if (isNaN(currentStatus)) currentStatus = 0;
  const newPrintStatus = currentStatus + 1;

  let newIsStatus = '120';
  if (newPrintStatus === 1) {
    newIsStatus = '121';
  } else if (newPrintStatus > 1) {
    newIsStatus = '122';
  }

  // [Timezone Fix] ใช้เวลา Bangkok
  const nowBangkok = getBangkokNow();

  const updateSql = `
    UPDATE tb_asset_lists 
    SET print_status = ?, is_status = ?, updated_by = ?, updated_at = ?
    WHERE asset_code = ?
  `;
  await db.query(updateSql, [newPrintStatus, newIsStatus, user, nowBangkok, assetCode]);

  // เตรียมข้อมูลสำหรับ Insert Log
  const logData = {
    ...currentData,
    print_status: newPrintStatus,
    is_status: newIsStatus,
    updated_by: user,
    updated_at: nowBangkok, // ใช้เวลา Bangkok
    asset_action: 'พิมพ์'
  };

  await insertDetailLog([logData]);

  return {
    print_status: newPrintStatus,
    is_status: newIsStatus
  };
}

/** * บันทึกรายการใหม่ 
 * (ลงทั้ง tb_asset_lists และ tb_asset_lists_detail โดย action='สร้าง') 
 */
async function createBulk(dataArray) {
  if (!dataArray || dataArray.length === 0) return;

  // [Timezone Fix] ใช้ item.created_at ที่ Controller ส่งมา (ซึ่งเป็น Bangkok แล้ว)
  // หรือถ้าไม่มี ให้ใช้ getBangkokNow()
  const valuesForMain = dataArray.map(item => [
    item.asset_code, item.asset_detail, item.asset_type, item.asset_date, item.doc_no,
    item.asset_lot, item.asset_holder, item.asset_location,
    item.asset_width, item.asset_width_unit,
    item.asset_length, item.asset_length_unit,
    item.asset_height, item.asset_height_unit,
    item.asset_capacity, item.asset_capacity_unit,
    item.asset_weight, item.asset_weight_unit,
    item.asset_img,
    item.asset_dmg_001, item.asset_dmg_002, item.asset_dmg_003,
    item.asset_dmg_004, item.asset_dmg_005, item.asset_dmg_006,
    item.asset_remark, item.asset_usedfor, item.asset_brand, item.asset_feature, item.asset_supplier_name, item.label_register, item.partCode,
    item.print_status, item.asset_status, item.is_status,
    // created_at, created_by, created_at
    item.created_at || getBangkokNow(), item.created_by, item.created_at || getBangkokNow()
  ]);

  const sqlMain = `
    INSERT INTO tb_asset_lists (
      asset_code, asset_detail, asset_type, asset_date, doc_no, 
      asset_lot, asset_holder, asset_location, 
      asset_width, asset_width_unit, 
      asset_length, asset_length_unit, 
      asset_height, asset_height_unit, 
      asset_capacity, asset_capacity_unit, 
      asset_weight, asset_weight_unit, 
      asset_img, 
      asset_dmg_001, asset_dmg_002, asset_dmg_003, asset_dmg_004, asset_dmg_005, asset_dmg_006,
      asset_remark, asset_usedfor, asset_brand, asset_feature, asset_supplier_name, label_register, partCode, 
      print_status, asset_status, is_status, 
      create_date, created_by, created_at
    ) VALUES ?
  `;

  const [result] = await db.query(sqlMain, [valuesForMain]);

  // ใน Detail Log: updated_by/updated_at เป็น NULL สำหรับ Action 'สร้าง'
  const dataForDetail = dataArray.map(item => ({
    ...item,
    updated_by: null,
    updated_at: null,
    asset_action: 'สร้าง'
  }));

  await insertDetailLog(dataForDetail);

  return result;
}

/** ฟังก์ชัน Helper สำหรับ Insert tb_asset_lists_detail */
async function insertDetailLog(dataObjArray) {
  if (!dataObjArray || dataObjArray.length === 0) return;

  const sql = `INSERT INTO tb_asset_lists_detail (${COLUMNS_LIST}) VALUES ?`;

  // [Timezone Fix] ใช้ getBangkokNow() เป็น default แทน new Date()
  const values = dataObjArray.map(item => [
    item.asset_code, item.asset_detail, item.asset_type, item.asset_date, item.doc_no,
    item.asset_lot, item.asset_holder, item.asset_location,
    item.asset_width, item.asset_width_unit,
    item.asset_length, item.asset_length_unit,
    item.asset_height, item.asset_height_unit,
    item.asset_capacity, item.asset_capacity_unit,
    item.asset_weight, item.asset_weight_unit,
    item.asset_img,
    item.asset_dmg_001, item.asset_dmg_002, item.asset_dmg_003, item.asset_dmg_004, item.asset_dmg_005, item.asset_dmg_006,
    item.asset_remark, item.asset_usedfor, item.asset_brand, item.asset_feature, item.asset_supplier_name, item.label_register, item.partCode,
    item.print_status, item.asset_status, item.is_status,

    // create_date / created_at (ถ้าไม่มีค่า ให้ใช้ Bangkok Now)
    item.create_date || getBangkokNow(),
    item.created_by,
    item.created_at || getBangkokNow(),

    // updated_by / updated_at
    item.updated_by,
    item.updated_at, // ค่านี้ถ้าส่งมาจะเป็น Bangkok แล้ว หรือถ้าเป็น null ก็ปล่อย null
    item.asset_action
  ]);

  await db.query(sql, [values]);
}

/** ลบข้อมูลตาม Lot (ลบทั้ง tb_asset_lists และ tb_asset_lists_detail) */
async function deleteByLot(lotNo) {
  const sqlDetail = `DELETE FROM tb_asset_lists_detail WHERE asset_lot = ?`;
  await db.query(sqlDetail, [lotNo]);

  const sqlMain = `DELETE FROM tb_asset_lists WHERE asset_lot = ?`;
  const [result] = await db.query(sqlMain, [lotNo]);

  return result;
}

/** * ยกเลิกรายการ (is_status = 99) 
 * และบันทึก History ลง tb_asset_lists_detail (Action = 'cancel')
 */
async function updateStatusCancel(assetCodes, user) {
  if (!assetCodes || assetCodes.length === 0) return { success: false };

  // 1. ดึงข้อมูลรายการที่เลือก พร้อม Join Status เพื่อเช็คชื่อและสี
  const checkSql = `
    SELECT a.*, 
           s.G_NAME as asset_status_name, 
           s.G_DESCRIPT as asset_status_color
    FROM tb_asset_lists a
    LEFT JOIN tb_erp_status s ON a.asset_status = s.G_CODE AND s.G_USE = 'A1'
    WHERE a.asset_code IN (?)
  `;
  const [rows] = await db.query(checkSql, [assetCodes]);

  if (rows.length === 0) return { success: false, message: 'ไม่พบข้อมูล' };

  // 2. ตรวจสอบเงื่อนไข: ต้องเป็น asset_status = '100' ทุกรายการ
  const invalidItem = rows.find(r => r.asset_status !== '100');

  if (invalidItem) {
    // เจอรายการที่สถานะไม่ใช่ 100 -> ห้ามยกเลิก ส่งข้อมูลกลับไปแจ้งเตือน
    return {
      success: false,
      errorType: 'INVALID_STATUS',
      invalidItem: {
        asset_code: invalidItem.asset_code,
        status_code: invalidItem.asset_status,
        status_name: invalidItem.asset_status_name || invalidItem.asset_status,
        status_color: invalidItem.asset_status_color || 'bg-gray-100 text-gray-600 border-gray-200'
      }
    };
  }

  // 3. ถ้าผ่านเงื่อนไขหมด -> ทำการ Update
  // [Timezone Fix] ใช้เวลา Bangkok
  const nowBangkok = getBangkokNow();

  const updateSql = `
    UPDATE tb_asset_lists 
    SET is_status = '99', 
        updated_by = ?, 
        updated_at = ?
    WHERE asset_code IN (?)
  `;
  const [result] = await db.query(updateSql, [user, nowBangkok, assetCodes]); // <--- แก้ไข: รับค่า result ตรงนี้

  // 4. เตรียมข้อมูลลง Log
  const logDataArray = rows.map(row => ({
    ...row,
    is_status: '99',
    updated_by: user,
    updated_at: nowBangkok,
    asset_action: 'ยกเลิก'
  }));

  await insertDetailLog(logDataArray);

  return { success: true, result };
}

/** ดึงประวัติการแก้ไข (History) จาก tb_asset_lists_detail ตาม asset_code */
async function getHistoryByCode(assetCode) {
  const sql = `
    SELECT d.*, 
           s1.G_NAME as asset_status_name, s1.G_DESCRIPT as asset_status_color,
           s2.G_NAME as is_status_name, s2.G_DESCRIPT as is_status_color,
           CONCAT(COALESCE(e1.titlename_th, ''), COALESCE(e1.firstname_th, ''), ' ', COALESCE(e1.lastname_th, '')) as booking_created_by,
           CONCAT(COALESCE(e2.titlename_th, ''), COALESCE(e2.firstname_th, ''), ' ', COALESCE(e2.lastname_th, '')) as updated_by_name,
           d.refID as refID,
           DATE_FORMAT(d.updated_at, '%Y-%m-%d') as create_date,
           DATE_FORMAT(d.updated_at, '%H:%i:%s') as create_time

    FROM tb_asset_lists_detail d
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
  getLastLotNumber,
  getLastAssetCodeRunning,
  getErpStatus,
  incrementPrintStatus,
  createBulk,
  deleteByLot,
  updateStatusCancel,
  getHistoryByCode
};