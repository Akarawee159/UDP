// src/modules/Smartpackage/systemOut/systemOutModel.js
'use strict';

const db = require('../../../config/database');

/** * Helper: Query ข้อมูล Asset รายตัว พร้อมชื่อสถานะและสี 
 * (ใช้สำหรับดึงข้อมูลล่าสุดเพื่อส่ง Socket)
 */
async function getAssetWithStatus(assetCode) {
  const sql = `
    SELECT a.*, 
           s1.G_NAME as asset_status_name, s1.G_DESCRIPT as asset_status_color,
           s2.G_NAME as is_status_name, s2.G_DESCRIPT as is_status_color
    FROM tb_asset_lists a
    LEFT JOIN tb_erp_status s1 ON a.asset_status = s1.G_CODE AND s1.G_USE = 'A1'
    LEFT JOIN tb_erp_status s2 ON a.is_status = s2.G_CODE AND s2.G_USE = 'A1'
    WHERE a.asset_code = ?
  `;
  const [rows] = await db.query(sql, [assetCode]);
  return rows[0]; // คืนค่า object ตัวเดียว
}

/** ดึงรายการที่ Status = 16 (รอจ่ายออก) */
async function getScannedAssets() {
  const sql = `
    SELECT 
      a.*,
      s.G_NAME as status_name,
      s.G_DESCRIPT as status_class
    FROM tb_asset_lists a
    LEFT JOIN tb_erp_status s ON a.asset_status = s.G_CODE AND s.G_USE = 'A1'
    WHERE a.asset_status = 16
    ORDER BY a.updated_at DESC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

/** สแกน QR Code (เปลี่ยน 10 -> 16) */
async function scanCheckIn(uniqueKey) {
  // 1. เช็คก่อนว่ามีของชิ้นนี้และสถานะเป็น 10
  const [rows] = await db.query(`SELECT * FROM tb_asset_lists WHERE asset_code = ?`, [uniqueKey]);

  if (rows.length === 0) return { success: false, message: 'ไม่พบทรัพย์สินนี้' };

  const item = rows[0];
  if (item.asset_status == 16) return { success: true, message: 'สินค้านี้ถูกสแกนไปแล้ว', data: await getAssetWithStatus(item.asset_code) }; // return data ล่าสุดเลย
  if (item.asset_status != 10) return { success: false, message: 'สถานะทรัพย์สินไม่ถูกต้อง (ไม่อยู่ในคลัง)' };

  // 2. อัปเดตเป็น 16
  await db.query(`UPDATE tb_asset_lists SET asset_status = 16, updated_at = NOW() WHERE asset_code = ?`, [item.asset_code]);

  // 3. ดึงข้อมูลล่าสุดพร้อมสี/ชื่อสถานะ กลับไป
  const updatedItem = await getAssetWithStatus(item.asset_code);
  return { success: true, data: updatedItem };
}

/** คืนคลัง (เปลี่ยน 16 -> 10) */
async function returnToStock(ids) {
  if (!ids || ids.length === 0) return [];

  // 1. Update
  const sql = `UPDATE tb_asset_lists SET asset_status = 10, updated_at = NOW() WHERE asset_code IN (?) AND asset_status = 16`;
  await db.query(sql, [ids]);

  // 2. ดึงข้อมูลที่เพิ่งอัปเดตกลับมา (เพื่อเอาไป Emit Socket)
  // ต้อง loop หรือ WHERE IN เพื่อดึงข้อมูลทีละตัวที่มี Status name/color
  const sqlFetch = `
    SELECT a.*, 
           s1.G_NAME as asset_status_name, s1.G_DESCRIPT as asset_status_color,
           s2.G_NAME as is_status_name, s2.G_DESCRIPT as is_status_color
    FROM tb_asset_lists a
    LEFT JOIN tb_erp_status s1 ON a.asset_status = s1.G_CODE AND s1.G_USE = 'A1'
    LEFT JOIN tb_erp_status s2 ON a.is_status = s2.G_CODE AND s2.G_USE = 'A1'
    WHERE a.asset_code IN (?)
  `;
  const [updatedRows] = await db.query(sqlFetch, [ids]);
  return updatedRows;
}

async function getZones() {
  const [rows] = await db.query(`SELECT G_NAME as name FROM tb_zone ORDER BY G_NAME ASC`);
  return rows;
}

module.exports = {
  getScannedAssets,
  scanCheckIn,
  returnToStock,
  getZones,
  getAssetWithStatus // เผื่อใช้ที่อื่น
};