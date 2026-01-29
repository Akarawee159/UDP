// src/modules/Smartpackage/systemIn/systemInModel.js
'use strict';

const db = require('../../../config/database');
const dayjs = require('dayjs');

const getThaiNow = () => {
  return dayjs().add(7, 'hour').format('YYYY-MM-DD HH:mm:ss');
};

// ✅ ปรับ: รับ type เพื่อกำหนด status เริ่มต้น (30=Good, 40=Defective)
async function createBooking(data) {
  const { draft_id, created_by, type } = data;
  const now = getThaiNow();

  // Default 30 (Good) if not specified
  let initStatus = '30';
  if (type === 'defective') initStatus = '40';

  const sql = `
    INSERT INTO booking_asset_lists 
    (draft_id, create_date, create_time, is_status, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE updated_at = ?
  `;
  const dateOnly = dayjs(now).format('YYYY-MM-DD');
  const timeOnly = dayjs(now).format('HH:mm:ss');

  await db.query(sql, [draft_id, dateOnly, timeOnly, initStatus, created_by, now, now]);
  return { draft_id };
}

async function generateRefID(draft_id, user_id) {
  // 1. ดึงสถานะปัจจุบันเพื่อตรวจสอบว่าเป็น Flow ไหน (30=Good, 40=Defective)
  const [bookingRes] = await db.query(`SELECT is_status FROM booking_asset_lists WHERE draft_id = ?`, [draft_id]);
  const status = bookingRes[0]?.is_status || '30'; // Default ไว้ที่ 30 หากไม่พบ

  // 2. กำหนด Prefix ตามสถานะ
  let prefix = 'RC'; // Default: Receive (ของดี)

  // หากสถานะขึ้นต้นด้วย '4' (เช่น 40, 41) ให้ใช้ DF (Defective)
  if (String(status).startsWith('4')) {
    prefix = 'DF';
  }

  // 3. คำนวณลำดับ
  const [countRes] = await db.query(`SELECT COUNT(*) as cnt FROM booking_asset_lists WHERE create_date = CURDATE()`);
  const seq = countRes[0].cnt + 1;

  const dateStr = dayjs().format('DDMMYY');

  // 4. สร้าง RefID ตาม Prefix ที่เลือก
  const refID = `${prefix}${dateStr}${String(seq).padStart(4, '0')}`;

  const now = getThaiNow();

  // 5. บันทึกลงฐานข้อมูล
  await db.query(`
        UPDATE booking_asset_lists
        SET refID = ?,
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [refID, user_id, now, draft_id]);

  return { refID };
}

// ✅ ปรับ: Update Header แล้วเปลี่ยนสถานะ (30->31, 40->41)
async function updateBookingHeader(draft_id, body, user_id) {
  const { booking_remark, origin, destination } = body;
  const now = getThaiNow();

  // เช็คสถานะปัจจุบันก่อน
  const [rows] = await db.query(`SELECT is_status FROM booking_asset_lists WHERE draft_id = ?`, [draft_id]);
  if (rows.length === 0) throw new Error("Booking not found");

  const currentStatus = rows[0].is_status;
  let nextStatus = currentStatus;

  if (currentStatus === '30') nextStatus = '31';
  if (currentStatus === '40') nextStatus = '41';

  await db.query(`
        UPDATE booking_asset_lists
        SET booking_remark = ?,
            origin = ?,
            destination = ?,
            is_status = ?, 
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [booking_remark, origin, destination, nextStatus, user_id, now, draft_id]);

  return { success: true };
}

// ✅ ปรับ: Scan Asset ตาม Type (Good=10/12, Defective=13/27)
async function scanCheckIn(uniqueKey, draft_id, refID, user_id) {
  const now = getThaiNow();

  // 1. Get Booking Type ... (คงเดิม)
  const [bookingRows] = await db.query(`SELECT is_status FROM booking_asset_lists WHERE draft_id = ?`, [draft_id]);
  if (bookingRows.length === 0) return { success: false, message: 'Booking not found' };

  const bookingStatus = bookingRows[0].is_status;
  const isGoodFlow = ['30', '31', '32', '33'].includes(bookingStatus);
  const isDefectiveFlow = ['40', '41', '42', '43'].includes(bookingStatus);

  if (!isGoodFlow && !isDefectiveFlow) return { success: false, message: 'Invalid Booking Status' };

  // 2. Get Asset ... (คงเดิม)
  const sqlGet = `
        SELECT a.*, 
               s1.G_NAME as asset_status_name, 
               s1.G_DESCRIPT as asset_status_color
        FROM tb_asset_lists a
        LEFT JOIN tb_erp_status s1 ON a.asset_status = s1.G_CODE AND s1.G_USE = 'A2'
        WHERE a.asset_code = ?
    `;
  const [rows] = await db.query(sqlGet, [uniqueKey]);
  const item = rows[0];

  if (!item) return { success: false, code: 'NOT_FOUND', message: 'ไม่พบทรัพย์สินนี้' };

  // 3. Logic Check
  // ถ้า Scan ซ้ำในใบเดิม
  if (item.refID === refID && item.draft_id === draft_id) {
    return { success: false, code: 'ALREADY_SCANNED', message: `รายการนี้ถูกสแกนแล้ว`, data: item };
  }

  // ✅ เพิ่ม: ตรวจสอบสถานะก่อนรับเข้า (ต้องเป็น Issued=11 และ SystemOut=18 เท่านั้น)
  // หมายเหตุ: ใช้ String() เผื่อ DB return มาเป็น number
  if (String(item.asset_status) !== '11') {
    return {
      success: false,
      code: 'INVALID_PRE_STATUS',
      message: 'ทรัพย์ต้องมีสถานะจ่ายออกแล้วเท่านั้น ถึงจะรับเข้าของดี หรือ รับเข้าของชำรุด ได้',
      data: item
    };
  }

  // ... (code ส่วนกำหนด targetAssetStatus และ update คงเดิม)
  let targetAssetStatus = 10;
  let targetIsStatus = '12';

  if (isDefectiveFlow) {
    targetAssetStatus = 13;
    targetIsStatus = '27';
  }

  // อัปเดต ... (คงเดิม)
  await db.query(`
        UPDATE tb_asset_lists 
        SET asset_status = ?,
            is_status = ?,
            draft_id = ?, 
            refID = ?,
            scan_by = ?, 
            scan_at = ?,
            updated_at = ?
        WHERE asset_code = ?
    `, [targetAssetStatus, targetIsStatus, draft_id, refID, user_id, now, now, item.asset_code]);

  const [updatedRows] = await db.query(sqlGet, [item.asset_code]);
  return { success: true, code: 'SUCCESS', data: updatedRows[0] };
}

// ✅ ปรับ: Finalize (31/32 -> 33, 41/42 -> 43) และ Insert Detail
async function finalizeBooking(draft_id, user_id) {
  const now = getThaiNow();

  // 1. Get Current Status
  const [bookingRes] = await db.query(`SELECT is_status, refID, origin, destination FROM booking_asset_lists WHERE draft_id = ?`, [draft_id]);
  const booking = bookingRes[0];
  if (!booking) throw new Error("Booking not found");

  const s = booking.is_status;
  let nextStatus = s;

  // Map Status
  if (s === '31' || s === '32') nextStatus = '33';
  if (s === '41' || s === '42') nextStatus = '43';

  // 2. Update Header
  await db.query(`
        UPDATE booking_asset_lists
        SET is_status = ?,
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [nextStatus, user_id, now, draft_id]);

  // 3. Insert Detail Logic
  const [currentAssets] = await db.query(`SELECT * FROM tb_asset_lists WHERE draft_id = ?`, [draft_id]);

  for (const t of currentAssets) {
    // ⚠️ แก้ไข: เปลี่ยน SELECT id เป็น SELECT asset_code เพื่อเช็คว่ามีข้อมูลหรือไม่
    const [exist] = await db.query(`SELECT asset_code FROM tb_asset_lists_detail WHERE refID = ? AND asset_code = ?`, [booking.refID, t.asset_code]);

    if (exist.length === 0) {
      await insertSingleDetail(t, booking.origin, booking.destination);
    }
  }

  return true;
}

async function insertSingleDetail(t, origin, destination) {
  const sql = `
        INSERT INTO tb_asset_lists_detail (
            draft_id, refID, asset_code, asset_detail, asset_type, asset_date, doc_no, asset_lot, 
            asset_holder, asset_location, asset_width, asset_width_unit, asset_length, asset_length_unit,
            asset_height, asset_height_unit, asset_capacity, asset_capacity_unit, asset_weight, asset_weight_unit, 
            asset_img, asset_dmg_001, asset_dmg_002, asset_dmg_003, asset_dmg_004, asset_dmg_005, asset_dmg_006,
            asset_remark, asset_usedfor, asset_brand, asset_feature, asset_supplier_name, label_register, 
            partCode, print_status, asset_status, asset_action, is_status, create_date, created_by, created_at,
            updated_by, updated_at, scan_by, scan_at, asset_origin, asset_destination
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, 'เคลื่อนไหว', ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?
        )
    `;
  const params = [
    t.draft_id, t.refID, t.asset_code, t.asset_detail, t.asset_type, t.asset_date, t.doc_no, t.asset_lot,
    t.asset_holder, t.asset_location, t.asset_width, t.asset_width_unit, t.asset_length, t.asset_length_unit,
    t.asset_height, t.asset_height_unit, t.asset_capacity, t.asset_capacity_unit, t.asset_weight, t.asset_weight_unit,
    t.asset_img, t.asset_dmg_001, t.asset_dmg_002, t.asset_dmg_003, t.asset_dmg_004, t.asset_dmg_005, t.asset_dmg_006,
    t.asset_remark, t.asset_usedfor, t.asset_brand, t.asset_feature, t.asset_supplier_name, t.label_register,
    t.partCode, t.print_status, t.asset_status, t.is_status, t.create_date, t.created_by, t.created_at,
    t.updated_by, t.updated_at, t.scan_by, t.scan_at, origin, destination
  ];
  await db.query(sql, params);
}

// ✅ ปรับ: Unlock (33->32, 43->42)
async function unlockBooking(draft_id, user_id) {
  const now = getThaiNow();

  const [rows] = await db.query(`SELECT is_status FROM booking_asset_lists WHERE draft_id = ?`, [draft_id]);
  if (rows.length === 0) return;
  const s = rows[0].is_status;
  let nextStatus = s;

  if (s === '33') nextStatus = '32';
  if (s === '43') nextStatus = '42';

  await db.query(`
        UPDATE booking_asset_lists
        SET is_status = ?,
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [nextStatus, user_id, now, draft_id]);
  return true;
}

// ✅ ปรับ: Return Single Asset (Logic Revert & Unlock Constraint)
async function returnSingleAsset(assetCode) {
  const now = getThaiNow();

  // 1. Get info
  const [rows] = await db.query(`
      SELECT a.*, b.is_status as booking_status, b.refID
      FROM tb_asset_lists a
      LEFT JOIN booking_asset_lists b ON a.draft_id = b.draft_id
      WHERE a.asset_code = ?
  `, [assetCode]);

  const item = rows[0];
  if (!item) return null;

  const bs = item.booking_status;

  if (bs === '32' || bs === '42') {
    const [detail] = await db.query(`SELECT asset_code FROM tb_asset_lists_detail WHERE refID = ? AND asset_code = ?`, [item.refID, assetCode]);
    if (detail.length > 0) {
      throw new Error("ไม่อนุญาตให้ยกเลิกรายการที่ยืนยันไปแล้วก่อนหน้าการปลดล็อค");
    }
  }

  // 2. Revert Logic (กลับค่าเดิมก่อนการรับเข้า)
  // ก่อนรับเข้า: asset_status = 11, is_status = 18
  let revertAssetStatus = 11;
  let revertIsStatus = '18'; // ✅ เพิ่มการคืนค่า is_status

  await db.query(`
          UPDATE tb_asset_lists 
          SET asset_status = ?, 
              is_status = ?, 
              draft_id = NULL, 
              refID = NULL, 
              scan_by = NULL, 
              scan_at = NULL, 
              updated_at = ?
          WHERE asset_code = ?
      `, [revertAssetStatus, revertIsStatus, now, assetCode]);

  return await getAssetWithStatus(assetCode);
}

// ✅ ปรับ: Cancel Booking (30/31 -> 34, 40/41 -> 44)
async function cancelBooking(draft_id, user_id) {
  const now = getThaiNow();

  const [rows] = await db.query(`SELECT is_status FROM booking_asset_lists WHERE draft_id = ?`, [draft_id]);
  if (rows.length === 0) return;
  const s = rows[0].is_status;
  let nextStatus = '19'; // Fallback

  if (['30', '31', '32', '33'].includes(s)) nextStatus = '34';
  if (['40', '41', '42', '43'].includes(s)) nextStatus = '44';

  await db.query(`UPDATE booking_asset_lists SET is_status = ?, updated_by = ?, updated_at = ? WHERE draft_id = ?`, [nextStatus, user_id, now, draft_id]);
  return true;
}

async function getAssetWithStatus(assetCode) {
  const sql = `
      SELECT a.*, 
             s1.G_NAME as asset_status_name, s1.G_DESCRIPT as asset_status_color
      FROM tb_asset_lists a
      LEFT JOIN tb_erp_status s1 ON a.asset_status = s1.G_CODE AND s1.G_USE = 'A2'
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
    LEFT JOIN tb_erp_status s ON a.asset_status = s.G_CODE AND s.G_USE = 'A2'
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
    LEFT JOIN tb_erp_status s ON b.is_status = s.G_CODE AND s.G_USE = 'A2'
    LEFT JOIN employees e ON b.created_by = e.employee_id
    WHERE b.is_status NOT IN ('16','17','18','19','34','44') 
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
  const results = [];
  for (const id of ids) {
    try {
      const res = await returnSingleAsset(id);
      if (res) results.push(res);
    } catch (e) {
      console.error(e);
    }
  }
  return results;
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