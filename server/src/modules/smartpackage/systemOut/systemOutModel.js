// src/modules/Smartpackage/systemOut/systemOutModel.js
'use strict';

const db = require('../../../config/database');
const dayjs = require('dayjs');

// ✅ Helper: สร้างเวลาปัจจุบันเป็น Timezone ไทย (UTC+7)
// หาก Server เป็น UTC การบวก 7 ชั่วโมงจะทำให้ได้เวลาไทยที่ถูกต้อง
const getThaiNow = () => {
  return dayjs().add(7, 'hour').format('YYYY-MM-DD HH:mm:ss');
};

async function createBooking(data) {
  const { draft_id, created_by } = data;
  const now = getThaiNow(); // ✅ ใช้เวลาไทย
  const sql = `
    INSERT INTO booking_asset_lists 
    (draft_id, create_date, create_time, is_status, created_by, created_at)
    VALUES (?, ?, ?, '16', ?, ?)
    ON DUPLICATE KEY UPDATE updated_at = ?
  `;
  // แยกวันที่และเวลาจากตัวแปร now
  const dateOnly = dayjs(now).format('YYYY-MM-DD');
  const timeOnly = dayjs(now).format('HH:mm:ss');

  await db.query(sql, [draft_id, dateOnly, timeOnly, created_by, now, now]);
  return { draft_id };
}

async function generateRefID(draft_id, user_id) {
  const [countRes] = await db.query(`SELECT COUNT(*) as cnt FROM booking_asset_lists WHERE create_date = CURDATE()`);
  const seq = countRes[0].cnt + 1;
  const dateStr = dayjs().format('DDMMYY');
  const refID = `RF${dateStr}${String(seq).padStart(4, '0')}`;
  const now = getThaiNow(); // ✅

  await db.query(`
        UPDATE booking_asset_lists
        SET refID = ?,
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [refID, user_id, now, draft_id]);

  return { refID };
}

async function updateBookingHeader(draft_id, body, user_id) {
  const { booking_remark, origin, destination } = body;
  const now = getThaiNow(); // ✅

  await db.query(`
        UPDATE booking_asset_lists
        SET booking_remark = ?,
            origin = ?,
            destination = ?,
            is_status = '17', 
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [booking_remark, origin, destination, user_id, now, draft_id]);

  return { success: true };
}

async function finalizeBooking(draft_id, user_id) {
  const now = getThaiNow(); // ✅
  await db.query(`
        UPDATE booking_asset_lists
        SET is_status = '18',
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [user_id, now, draft_id]);
  return true;
}

async function unlockBooking(draft_id, user_id) {
  const now = getThaiNow(); // ✅
  await db.query(`
        UPDATE booking_asset_lists
        SET is_status = '17',
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [user_id, now, draft_id]);
  return true;
}

async function scanCheckIn(uniqueKey, draft_id, refID, user_id) {
  const now = getThaiNow(); // ✅

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

  if (item.asset_status == 11) {
    if (item.refID === refID) {
      return { success: false, code: 'ALREADY_SCANNED', message: `รายการนี้ถูกจ่ายออกไปแล้วในใบเบิกนี้`, data: item };
    } else {
      return { success: false, code: 'INVALID_STATUS', message: `ไม่สามารถสแกนได้ เนื่องจากสินค้านี้ถูกจ่ายออกไปแล้ว`, data: item };
    }
  }

  if (item.asset_status != 10) {
    return { success: false, code: 'INVALID_STATUS', message: `ไม่สามารถสแกนได้ เนื่องจากสถานะไม่พร้อมใช้งาน`, data: item };
  }

  await db.query(`
        UPDATE tb_asset_lists 
        SET asset_status = 11, 
            draft_id = ?, 
            refID = ?,
            scan_by = ?, 
            scan_at = ?,
            updated_at = ?
        WHERE asset_code = ?
    `, [draft_id, refID, user_id, now, now, item.asset_code]);

  const [updatedRows] = await db.query(sqlGet, [item.asset_code]);
  return { success: true, code: 'SUCCESS', data: updatedRows[0] };
}

async function returnSingleAsset(assetCode) {
  const now = getThaiNow(); // ✅
  await db.query(`
          UPDATE tb_asset_lists 
          SET asset_status = 10, 
              draft_id = NULL, 
              refID = NULL, 
              scan_by = NULL, 
              scan_at = NULL, 
              updated_at = ?
          WHERE asset_code = ?
      `, [now, assetCode]);
  return await getAssetWithStatus(assetCode);
}

// ... (Functions เดิม: getAssetWithStatus, getAssetsByDraft, getZones, getAllBookings, getBookingDetail) ...
// ให้คงไว้ตามเดิม (หากมีการใช้ NOW() ใน function เหล่านี้ ให้เปลี่ยนเป็น getThaiNow() ด้วย แต่ส่วนใหญ่เป็น SELECT)

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
      s.G_DESCRIPT as status_class,
      CONCAT(COALESCE(e.titlename_th,''), '', COALESCE(e.firstname_th,''), ' ', COALESCE(e.lastname_th,'')) as scan_by_name
    FROM tb_asset_lists a
    LEFT JOIN tb_erp_status s ON a.asset_status = s.G_CODE AND s.G_USE = 'A1'
    LEFT JOIN employees e ON a.scan_by = e.employee_id
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
  const sql = `
    SELECT 
        b.*, 
        s.G_NAME as is_status_name, 
        s.G_DESCRIPT as is_status_color,
        CONCAT(COALESCE(e.titlename_th,''), '', COALESCE(e.firstname_th,''), ' ', COALESCE(e.lastname_th,'')) as created_by_name
    FROM booking_asset_lists b
    LEFT JOIN tb_erp_status s ON b.is_status = s.G_CODE AND s.G_USE = 'A1'
    LEFT JOIN employees e ON b.created_by = e.employee_id
    WHERE b.is_status != '19'
    ORDER BY b.created_at DESC
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
  const now = getThaiNow(); // ✅
  const sql = `UPDATE tb_asset_lists SET asset_status = 10, draft_id = NULL, refID = NULL, updated_at = ? WHERE asset_code IN (?) AND asset_status = 11`;
  await db.query(sql, [now, ids]);

  // Fetch logic...
  const sqlFetch = `
      SELECT a.*, s1.G_NAME as asset_status_name, s1.G_DESCRIPT as asset_status_color
      FROM tb_asset_lists a
      LEFT JOIN tb_erp_status s1 ON a.asset_status = s1.G_CODE AND s1.G_USE = 'A1'
      WHERE a.asset_code IN (?)
    `;
  const [updatedRows] = await db.query(sqlFetch, [ids]);
  return updatedRows;
}

async function cancelBooking(draft_id, user_id) {
  const now = getThaiNow(); // ✅
  // ยกเลิกเปลี่ยนสถานะเป็น 19 (Cancelled)
  const sql = `UPDATE booking_asset_lists SET is_status = '19', updated_by = ?, updated_at = ? WHERE draft_id = ?`;
  await db.query(sql, [user_id, now, draft_id]);
  return true;
}

module.exports = {
  createBooking,
  generateRefID,
  updateBookingHeader,
  finalizeBooking,
  unlockBooking,
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