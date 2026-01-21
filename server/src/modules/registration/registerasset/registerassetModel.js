// src/modules/registration/registerasset/registerassetModel.js
'use strict';

const db = require('../../../config/database');

/** ดึงรายการทั้งหมด พร้อม Join ตารางสถานะ (ถ้าต้องการใช้ในอนาคต) */
async function getAll() {
  const sql = `
    SELECT a.*, 
           s1.G_NAME as asset_status_name, s1.G_DESCRIPT as asset_status_color,
           s2.G_NAME as is_status_name, s2.G_DESCRIPT as is_status_color
    FROM tb_asset_lists a
    LEFT JOIN tb_erp_status s1 ON a.asset_status = s1.G_CODE AND s1.G_USE = 'A1'
    LEFT JOIN tb_erp_status s2 ON a.is_status = s2.G_CODE AND s2.G_USE = 'A1'
    ORDER BY a.asset_code ASC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

/** หา Lot Number ล่าสุดของวันนี้ */
async function getLastLotNumber(dateStr) {
  const pattern = `LOT${dateStr}%`;
  const sql = `SELECT asset_lot FROM tb_asset_lists WHERE asset_lot LIKE ? ORDER BY asset_lot DESC LIMIT 1`;
  const [rows] = await db.query(sql, [pattern]);
  return rows.length > 0 ? rows[0].asset_lot : null;
}

/** หา Running Number ล่าสุด */
async function getLastAssetCodeRunning(baseCode) {
  const pattern = `${baseCode}-%`;
  const sql = `SELECT asset_code FROM tb_asset_lists WHERE asset_code LIKE ? ORDER BY length(asset_code) DESC, asset_code DESC LIMIT 1`;
  const [rows] = await db.query(sql, [pattern]);
  return rows.length > 0 ? rows[0].asset_code : null;
}

/** ดึงข้อมูลสถานะจาก tb_erp_status */
async function getErpStatus(gUse, gCode) {
  const sql = `SELECT G_NAME, G_DESCRIPT FROM tb_erp_status WHERE G_USE = ? AND G_CODE = ? LIMIT 1`;
  const [rows] = await db.query(sql, [gUse, gCode]);
  return rows.length > 0 ? rows[0] : null;
}

/** อัปเดตสถานะการพิมพ์ (+1) */
async function incrementPrintStatus(assetCode) {
  // ตรวจสอบค่าปัจจุบันก่อน
  const checkSql = `SELECT print_status FROM tb_asset_lists WHERE asset_code = ?`;
  const [rows] = await db.query(checkSql, [assetCode]);

  if (rows.length === 0) return null;

  let currentStatus = parseInt(rows[0].print_status);
  if (isNaN(currentStatus)) currentStatus = 0;

  const newStatus = currentStatus + 1;

  const updateSql = `UPDATE tb_asset_lists SET print_status = ? WHERE asset_code = ?`;
  await db.query(updateSql, [newStatus, assetCode]);

  return newStatus;
}

/** บันทึกรายการใหม่ */
async function createBulk(dataArray) {
  if (!dataArray || dataArray.length === 0) return;

  const sql = `
    INSERT INTO tb_asset_lists (
      asset_code, asset_detail, asset_type, asset_date, doc_no, 
      asset_lot, asset_holder, asset_location, 
      asset_width, asset_width_unit, 
      asset_length, asset_length_unit, 
      asset_height, asset_height_unit, 
      asset_capacity, asset_capacity_unit, 
      asset_weight, asset_weight_unit, 
      asset_img, label_register, partCode, 
      print_status, asset_status, is_status, 
      create_date, created_by
    ) VALUES ?
  `;

  const values = dataArray.map(item => [
    item.asset_code, item.asset_detail, item.asset_type, item.asset_date, item.doc_no,
    item.asset_lot, item.asset_holder, item.asset_location,
    item.asset_width, item.asset_width_unit,
    item.asset_length, item.asset_length_unit,
    item.asset_height, item.asset_height_unit,
    item.asset_capacity, item.asset_capacity_unit,
    item.asset_weight, item.asset_weight_unit,
    item.asset_img, item.label_register, item.partCode,
    item.print_status, item.asset_status, item.is_status,
    new Date(), item.created_by
  ]);

  const [result] = await db.query(sql, [values]);
  return result;
}

async function deleteByLot(lotNo) {
  const sql = `DELETE FROM tb_asset_lists WHERE asset_lot = ?`;
  const [result] = await db.query(sql, [lotNo]);
  return result;
}

module.exports = {
  getAll,
  getLastLotNumber,
  getLastAssetCodeRunning,
  getErpStatus,
  incrementPrintStatus,
  createBulk,
  deleteByLot
};