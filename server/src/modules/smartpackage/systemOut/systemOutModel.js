// src/modules/Smartpackage/systemOut/systemOutModel.js
'use strict';

const db = require('../../../config/database');
const dayjs = require('dayjs');

// ... (createBooking, generateRefID คงเดิม)
/** Create Initial Booking (Draft) */
async function createBooking(data) {
  const { draft_id, created_by } = data;
  const sql = `
    INSERT INTO booking_asset_lists 
    (draft_id, create_date, create_time, is_status, created_by, created_at)
    VALUES (?, CURDATE(), CURTIME(), '16', ?, NOW())
    ON DUPLICATE KEY UPDATE updated_at = NOW()
  `;
  await db.query(sql, [draft_id, created_by]);
  return { draft_id };
}

async function generateRefID(draft_id, user_id) {
  const [countRes] = await db.query(`SELECT COUNT(*) as cnt FROM booking_asset_lists WHERE create_date = CURDATE()`);
  const seq = countRes[0].cnt + 1;
  const dateStr = dayjs().format('DDMMYY');
  const refID = `RF${dateStr}${String(seq).padStart(4, '0')}`;

  await db.query(`
        UPDATE booking_asset_lists
        SET refID = ?,
            is_status = '11',
            updated_by = ?,
            updated_at = NOW()
        WHERE draft_id = ?
    `, [refID, user_id, draft_id]);

  return { refID };
}

/** * ✅ ปรับปรุง: อัปเดตข้อมูลหัวบิล (Origin, Destination, Remark) 
 * ใช้แทน confirmTransaction แบบเดิมที่เคยสร้าง RefID
 */
async function updateBookingHeader(draft_id, body, user_id) {
  const { booking_remark, origin, destination } = body;
  // ตรวจสอบว่าตาราง booking_asset_lists มีคอลัมน์ origin, destination หรือไม่ 
  // ถ้าไม่มีต้องไป ALTER TABLE เพิ่ม: origin varchar(255), destination varchar(255)

  await db.query(`
        UPDATE booking_asset_lists
        SET booking_remark = ?,
            origin = ?,
            destination = ?,
            updated_by = ?,
            updated_at = NOW()
        WHERE draft_id = ?
    `, [booking_remark, origin, destination, user_id, draft_id]);

  return { success: true };
}

/** ✅ Scan Logic */
async function scanCheckIn(uniqueKey, draft_id, refID, user_id) {
  const sqlGet = `
        SELECT a.*, 
               s1.G_NAME as asset_status_name, 
               s1.G_DESCRIPT as asset_status_color
        FROM tb_asset_lists a
        LEFT JOIN tb_erp_status s1 ON a.asset_status = s1.G_CODE AND s1.G_USE = 'A1'
        WHERE a.asset_code = ?
    `;
  const [rows] = await db.query(sqlGet, [uniqueKey]);
  const item = rows[0];

  if (!item) return { success: false, code: 'NOT_FOUND', message: 'ไม่พบทรัพย์สินนี้' };

  // ✅ ตรวจสอบสถานะ 11 (ถูกจ่ายออกไปแล้ว)
  if (item.asset_status == 11) {
    // เงื่อนไข 1: จ่ายออกไปใน "ใบเบิกเดียวกัน" (refID ตรงกัน) -> ถามเพื่อยกเลิก
    if (item.refID === refID) {
      return {
        success: false,
        code: 'ALREADY_SCANNED', // ใช้ Code นี้เพื่อ Trigger Modal ยกเลิก
        message: `รายการนี้ถูกจ่ายออกไปแล้วในใบเบิกนี้`,
        data: item
      };
    }
    // เงื่อนไข 2: จ่ายออกไปใน "ใบเบิกอื่น" -> แจ้งเตือน Error
    else {
      return {
        success: false,
        code: 'INVALID_STATUS',
        message: `ไม่สามารถสแกนได้ เนื่องจากสินค้านี้ถูกจ่ายออกไปแล้ว`,
        data: item // ใน item มี refID ของใบเดิมติดอยู่ เอาไปแสดงผลได้
      };
    }
  }

  // เงื่อนไข 3: สถานะอื่นๆ ที่ไม่ใช่ 10 (ว่าง) -> แจ้งเตือน Error
  if (item.asset_status != 10) {
    return {
      success: false,
      code: 'INVALID_STATUS',
      message: `ไม่สามารถสแกนได้ เนื่องจากสถานะไม่พร้อมใช้งาน`,
      data: item
    };
  }

  // ✅ ผ่านทุกเงื่อนไข -> ตัดจ่าย (10 -> 11)
  await db.query(`
        UPDATE tb_asset_lists 
        SET asset_status = 11, 
            draft_id = ?, 
            refID = ?,
            scan_by = ?, 
            scan_at = NOW(),
            updated_at = NOW() 
        WHERE asset_code = ?
    `, [draft_id, refID, user_id, item.asset_code]);

  const [updatedRows] = await db.query(sqlGet, [item.asset_code]);
  return { success: true, code: 'SUCCESS', data: updatedRows[0] };
}

/** ✅ ยกเลิกจ่ายออก (11 -> 10) */
async function returnSingleAsset(assetCode) {
  // เคลียร์ Draft ID, Ref ID กลับเป็น NULL, Status 10
  await db.query(`
        UPDATE tb_asset_lists 
        SET asset_status = 10, 
            draft_id = NULL, 
            refID = NULL, 
            scan_by = NULL, 
            scan_at = NULL, 
            updated_at = NOW() 
        WHERE asset_code = ?
    `, [assetCode]);
  return await getAssetWithStatus(assetCode);
}

// ... (getAssetWithStatus, getAssetsByDraft, getZones, getAllBookings, getBookingDetail, returnToStock คงเดิม)
async function getAssetWithStatus(assetCode) {
  const sql = `
    SELECT a.*, 
           s1.G_NAME as asset_status_name, s1.G_DESCRIPT as asset_status_color
    FROM tb_asset_lists a
    LEFT JOIN tb_erp_status s1 ON a.asset_status = s1.G_CODE AND s1.G_USE = 'A1'
    WHERE a.asset_code = ?
  `;
  const [rows] = await db.query(sql, [assetCode]);
  return rows[0];
}

async function getAssetsByDraft(draft_id) {
  const sql = `
    SELECT 
      a.*,
      s.G_NAME as status_name,
      s.G_DESCRIPT as status_class
    FROM tb_asset_lists a
    LEFT JOIN tb_erp_status s ON a.asset_status = s.G_CODE AND s.G_USE = 'A1'
    WHERE a.draft_id = ? 
    ORDER BY a.updated_at DESC
  `;
  const [rows] = await db.query(sql, [draft_id]);
  return rows;
}

async function getZones() {
  const [rows] = await db.query(`SELECT G_NAME as name FROM tb_zone ORDER BY G_NAME ASC`);
  return rows;
}

async function getAllBookings() {
  // ✅ แก้ไข: เพิ่มเงื่อนไข WHERE is_status != '17'
  const sql = `
    SELECT * FROM booking_asset_lists 
    WHERE is_status != '17'
    ORDER BY created_at DESC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

async function getBookingDetail(draft_id) {
  const sql = `SELECT * FROM booking_asset_lists WHERE draft_id = ?`;
  const [rows] = await db.query(sql, [draft_id]);
  return rows[0];
}

async function returnToStock(ids) {
  if (!ids || ids.length === 0) return [];
  // แก้ไขเป็น Reset Status 11 -> 10 
  const sql = `UPDATE tb_asset_lists SET asset_status = 10, draft_id = NULL, refID = NULL, updated_at = NOW() WHERE asset_code IN (?) AND asset_status = 11`;
  await db.query(sql, [ids]);

  const sqlFetch = `
    SELECT a.*, s1.G_NAME as asset_status_name, s1.G_DESCRIPT as asset_status_color
    FROM tb_asset_lists a
    LEFT JOIN tb_erp_status s1 ON a.asset_status = s1.G_CODE AND s1.G_USE = 'A1'
    WHERE a.asset_code IN (?)
  `;
  const [updatedRows] = await db.query(sqlFetch, [ids]);
  return updatedRows;
}

/** ✅ ยกเลิกใบเบิก (กลับเป็นสถานะ 16) */
async function cancelBooking(draft_id, user_id) {
  const sql = `
        UPDATE booking_asset_lists
        SET is_status = '17',
            updated_by = ?,
            updated_at = NOW()
        WHERE draft_id = ?
    `;
  await db.query(sql, [user_id, draft_id]);
  return true;
}
module.exports = {
  createBooking,
  generateRefID,
  updateBookingHeader, // New
  scanCheckIn,
  returnSingleAsset,
  getAssetsByDraft,
  getAssetWithStatus,
  getZones,
  getAllBookings,
  getBookingDetail,
  returnToStock,
  cancelBooking
};