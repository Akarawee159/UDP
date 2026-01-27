// src/modules/registration/registerasset/registerassetModel.js
'use strict';

const db = require('../../../config/database');

// รายชื่อคอลัมน์สำหรับ tb_asset_lists และ tb_asset_lists_detail (ไม่รวม id)
// เพิ่ม asset_action เข้าไปในลิสต์นี้เพื่อให้จัดการง่ายขึ้น
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
  // 1. ดึงข้อมูลปัจจุบันก่อน
  const checkSql = `SELECT * FROM tb_asset_lists WHERE asset_code = ?`;
  const [rows] = await db.query(checkSql, [assetCode]);

  if (rows.length === 0) return null;
  const currentData = rows[0];

  // 2. คำนวณสถานะใหม่
  let currentStatus = parseInt(currentData.print_status);
  if (isNaN(currentStatus)) currentStatus = 0;
  const newPrintStatus = currentStatus + 1;

  let newIsStatus = '20';
  if (newPrintStatus === 1) {
    newIsStatus = '21';
  } else if (newPrintStatus > 1) {
    newIsStatus = '22';
  }

  const now = new Date();

  // 3. อัปเดตตารางหลัก
  const updateSql = `
    UPDATE tb_asset_lists 
    SET print_status = ?, is_status = ?, updated_by = ?, updated_at = ?
    WHERE asset_code = ?
  `;
  await db.query(updateSql, [newPrintStatus, newIsStatus, user, now, assetCode]);

  // 4. เตรียมข้อมูลสำหรับ Insert Log (ใช้ข้อมูลเดิม แต่ทับค่าใหม่ที่เปลี่ยนไป)
  const logData = {
    ...currentData,
    print_status: newPrintStatus,
    is_status: newIsStatus,
    updated_by: user,
    updated_at: now,
    asset_action: 'print' // Action ตามโจทย์
  };

  // 5. Insert ลง Detail
  await insertDetailLog([logData]);

  return {
    print_status: newPrintStatus,
    is_status: newIsStatus
  };
}

/** * บันทึกรายการใหม่ 
 * (ลงทั้ง tb_asset_lists และ tb_asset_lists_detail โดย action='first-time') 
 */
async function createBulk(dataArray) {
  if (!dataArray || dataArray.length === 0) return;

  // แปลง data object เป็น array เพื่อ insert
  const valuesMain = dataArray.map(item => [
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
    new Date(), item.created_by, new Date(),
    null, null, null // updated_by, updated_at, asset_action (ใน Main อาจเป็น null)
  ]);

  // 1. Insert ตารางหลัก (Column list ต้องตรงกับ values)
  // ตัด asset_action ออกจาก Main หรือไม่? ถ้า Main ไม่มี col นี้ให้ลบออก 
  // แต่ถ้า Main มี col นี้ ให้ใส่ 'first-time' หรือ null ก็ได้ 
  // *สมมติว่าตาราง Main ไม่มี asset_action ให้ใช้ SQL แยก*

  // เพื่อความชัวร์ ผมจะเขียน SQL แยกสำหรับ Main และ Detail

  const columnsMain = COLUMNS_LIST.replace(', asset_action', ''); // เอา action ออกจากตารางหลัก (ถ้าไม่มี)
  // หรือถ้าตารางหลักมี asset_action ให้แก้ตรงนี้ได้เลย

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
    new Date(), item.created_by, new Date()
  ]);

  const [result] = await db.query(sqlMain, [valuesForMain]);

  // 2. Insert Detail (Log) : Action = 'first-time'
  const dataForDetail = dataArray.map(item => ({
    ...item,
    updated_by: item.created_by, // ใช้คนสร้างเป็นคน update ใน log แรก
    updated_at: new Date(),
    asset_action: 'first-time'
  }));

  await insertDetailLog(dataForDetail);

  return result;
}

/** ฟังก์ชัน Helper สำหรับ Insert tb_asset_lists_detail */
async function insertDetailLog(dataObjArray) {
  if (!dataObjArray || dataObjArray.length === 0) return;

  const sql = `INSERT INTO tb_asset_lists_detail (${COLUMNS_LIST}) VALUES ?`;

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
    item.create_date || new Date(), item.created_by, item.created_at || new Date(),
    item.updated_by, item.updated_at, item.asset_action
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
  if (!assetCodes || assetCodes.length === 0) return;

  // 1. ดึงข้อมูลเดิมก่อนอัปเดต เพื่อเอามาทำ Log
  const selectSql = `SELECT * FROM tb_asset_lists WHERE asset_code IN (?)`;
  const [originalRows] = await db.query(selectSql, [assetCodes]);

  if (originalRows.length === 0) return;

  const now = new Date();

  // 2. อัปเดตตารางหลัก
  const updateSql = `
    UPDATE tb_asset_lists 
    SET is_status = '99', 
        updated_by = ?, 
        updated_at = ?
    WHERE asset_code IN (?)
  `;
  const [result] = await db.query(updateSql, [user, now, assetCodes]);

  // 3. เตรียมข้อมูลลง Log (Detail)
  // ให้ข้อมูล log เป็นข้อมูลใหม่ (status=99, action=cancel)
  const logDataArray = originalRows.map(row => ({
    ...row,
    is_status: '99',
    updated_by: user,
    updated_at: now,
    asset_action: 'cancel'
  }));

  // 4. Insert Detail
  await insertDetailLog(logDataArray);

  return result;
}

/** ดึงประวัติการแก้ไข (History) จาก tb_asset_lists_detail ตาม asset_code */
async function getHistoryByCode(assetCode) {
  // เรียงตามเวลาล่าสุด (updated_at DESC)
  const sql = `
    SELECT d.*, 
           s1.G_NAME as asset_status_name, s1.G_DESCRIPT as asset_status_color,
           s2.G_NAME as is_status_name, s2.G_DESCRIPT as is_status_color
    FROM tb_asset_lists_detail d
    LEFT JOIN tb_erp_status s1 ON d.asset_status = s1.G_CODE AND s1.G_USE = 'A1'
    LEFT JOIN tb_erp_status s2 ON d.is_status = s2.G_CODE AND s2.G_USE = 'A1'
    WHERE d.asset_code = ?
    ORDER BY updated_at DESC, asset_action DESC
  `;
  const [rows] = await db.query(sql, [assetCode]);
  return rows;
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