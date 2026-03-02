// src/modules/Smartpackage/systemIn/systemInModel.js
'use strict';

const db = require('../../../config/database');
const dayjs = require('dayjs');

// ✅ Helper: สร้างเวลาปัจจุบันเป็น Timezone ไทย (UTC+7)
const getThaiNow = () => {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
};

async function createBooking(data) {
  const { draft_id, created_by, objective, booking_type } = data;
  const now = getThaiNow();

  const sql = `
    INSERT INTO booking_asset_lists 
    (draft_id, create_date, create_time, is_status, created_by, created_at, objective, booking_type)
    VALUES (?, ?, ?, '130', ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE updated_at = ?
  `;
  const dateOnly = dayjs(now).format('YYYY-MM-DD');
  const timeOnly = dayjs(now).format('HH:mm:ss');

  await db.query(sql, [
    draft_id, dateOnly, timeOnly, created_by, now,
    objective || null, booking_type || null, // Insert new columns
    now
  ]);
  return { draft_id };
}

// RC 
async function generateRefID(draft_id, user_id) {
  const dateStr = dayjs().format('DDMMYY'); // วันที่ปัจจุบัน DDMMYY
  const prefix = `RC${dateStr}`; // Prefix ที่ต้องการค้นหา เช่น RF040226

  // ค้นหา RefID ล่าสุดของวันนี้ ที่ขึ้นต้นด้วย RC เท่านั้น (เพื่อไม่ให้นับรวมเอกสารประเภทอื่น)
  // ใช้ LIKE 'RF040226%' และเรียงลำดับจากมากไปน้อยเพื่อเอาตัวล่าสุด
  const sqlGetLast = `
      SELECT refID 
      FROM booking_asset_lists 
      WHERE refID LIKE CONCAT(?, '%') 
      ORDER BY refID DESC 
      LIMIT 1
  `;

  const [rows] = await db.query(sqlGetLast, [prefix]);

  let seq = 1;
  if (rows.length > 0 && rows[0].refID) {
    // ตัวอย่าง RF0402260001 -> ตัดเอา 4 ตัวท้ายมาบวก 1
    const lastRef = rows[0].refID;
    const lastSeqStr = lastRef.substring(lastRef.length - 4);
    const lastSeq = parseInt(lastSeqStr, 10);

    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  const refID = `${prefix}${String(seq).padStart(4, '0')}`;
  const now = getThaiNow();

  // อัปเดต refID กลับเข้าไป
  await db.query(`
        UPDATE booking_asset_lists
        SET refID = ?,
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [refID, user_id, now, draft_id]);

  return { refID };
}

// 1. ปรับฟังก์ชันอัปเดต Header (บันทึกข้อมูล และสร้าง RefID อัตโนมัติถ้ายังไม่มี)
// ใน updateBookingHeader
async function updateBookingHeader(draft_id, body, user_id) {
  const { booking_remark, origin, destination } = body;
  const now = getThaiNow();

  const [bookingRes] = await db.query(`SELECT refID FROM booking_asset_lists WHERE draft_id = ?`, [draft_id]);
  let currentRefID = bookingRes[0]?.refID;

  if (!currentRefID) {
    const dateStr = dayjs().format('DDMMYY');
    const prefix = `RC${dateStr}`;
    const [rows] = await db.query(`SELECT refID FROM booking_asset_lists WHERE refID LIKE CONCAT(?, '%') ORDER BY refID DESC LIMIT 1`, [prefix]);
    let seq = 1;
    if (rows.length > 0 && rows[0].refID) {
      seq = parseInt(rows[0].refID.substring(rows[0].refID.length - 4), 10) + 1;
    }
    currentRefID = `${prefix}${String(seq).padStart(4, '0')}`;
  }

  await db.query(`
        UPDATE booking_asset_lists
        SET refID = ?, booking_remark = ?, origin = ?, destination = ?, is_status = '131', updated_by = ?, updated_at = ?
        WHERE draft_id = ?
    `, [currentRefID, booking_remark, origin, destination, user_id, now, draft_id]);

  await db.query(`
        UPDATE tb_asset_lists SET asset_origin = ?, asset_destination = ?, updated_at = ? WHERE draft_id = ?
    `, [origin, destination, now, draft_id]);

  if (currentRefID) {
    await db.query(`
        UPDATE tb_asset_lists_detail 
        SET asset_origin = ?, asset_destination = ?, updated_at = ? 
        WHERE refID = ? AND asset_status = '100' AND is_status = '135' -- ⬅️ ปรับเป็น 100
    `, [origin, destination, now, currentRefID]);
  }

  return { success: true, refID: currentRefID };
}

// ใน getAssetsDetailByRefID
async function getAssetsDetailByRefID(refID) {
  const sql = `
        SELECT d.*, s.G_NAME as status_name, s.G_DESCRIPT as status_class, CONCAT(COALESCE(e.titlename_th,''), '', COALESCE(e.firstname_th,''), ' ', COALESCE(e.lastname_th,'')) as scan_by_name
        FROM tb_asset_lists_detail d
        LEFT JOIN tb_erp_status s ON d.asset_status = s.G_CODE AND s.G_USE = 'A1'
        LEFT JOIN employees e ON d.scan_by = e.employee_id
        WHERE d.refID = ? AND d.is_status = '135' AND d.asset_status = '100' -- ⬅️ ปรับเป็น 100
        ORDER BY d.asset_code ASC
    `;
  const [rows] = await db.query(sql, [refID]);
  return rows;
}


// ในไฟล์ src/modules/Smartpackage/systemIn/systemInModel.js

async function getAssetsByMasterRefID(refID) {
  const sql = `
        SELECT * FROM (
            -- 1. เลือกคอลัมน์จากตารางหลัก (tb_asset_lists)
            SELECT a.draft_id, a.refID, a.asset_code, a.asset_detail, a.asset_type, 
                   a.asset_width, a.asset_width_unit, a.asset_length, a.asset_length_unit, 
                   a.asset_height, a.asset_height_unit, a.asset_capacity, a.asset_capacity_unit, 
                   a.asset_weight, a.asset_weight_unit, a.asset_img, a.asset_remark, 
                   a.asset_dmg_001, a.asset_dmg_002, a.asset_dmg_003, a.asset_dmg_004, a.asset_dmg_005, a.asset_dmg_006, 
                   a.partCode, a.asset_status, a.is_status, a.scan_by, a.scan_at, a.updated_at,
                   s.G_NAME as status_name, 
                   s.G_DESCRIPT as status_class, 
                   CONCAT(COALESCE(e.titlename_th,''), '', COALESCE(e.firstname_th,''), ' ', COALESCE(e.lastname_th,'')) as scan_by_name
            FROM tb_asset_lists a
            LEFT JOIN tb_erp_status s ON a.asset_status = s.G_CODE AND s.G_USE = 'A1'
            LEFT JOIN employees e ON a.scan_by = e.employee_id
            WHERE a.refID = ? 

            UNION ALL

            -- 2. เลือกคอลัมน์จากตารางประวัติ (tb_asset_lists_detail) โดยเรียงให้ตรงกับด้านบนเป๊ะๆ
            SELECT d.draft_id, d.refID, d.asset_code, d.asset_detail, d.asset_type, 
                   d.asset_width, d.asset_width_unit, d.asset_length, d.asset_length_unit, 
                   d.asset_height, d.asset_height_unit, d.asset_capacity, d.asset_capacity_unit, 
                   d.asset_weight, d.asset_weight_unit, d.asset_img, d.asset_remark, 
                   d.asset_dmg_001, d.asset_dmg_002, d.asset_dmg_003, d.asset_dmg_004, d.asset_dmg_005, d.asset_dmg_006, 
                   d.partCode, d.asset_status, d.is_status, d.scan_by, d.scan_at, d.updated_at,
                   s.G_NAME as status_name, 
                   s.G_DESCRIPT as status_class, 
                   CONCAT(COALESCE(e.titlename_th,''), '', COALESCE(e.firstname_th,''), ' ', COALESCE(e.lastname_th,'')) as scan_by_name
            FROM tb_asset_lists_detail d
            LEFT JOIN tb_erp_status s ON d.asset_status = s.G_CODE AND s.G_USE = 'A1'
            LEFT JOIN employees e ON d.scan_by = e.employee_id
            WHERE d.refID = ? 
              AND d.asset_status = '100'
              AND d.is_status = '135'
              AND d.asset_code NOT IN (SELECT asset_code FROM tb_asset_lists WHERE refID = ?)
        ) as combined_data
        ORDER BY updated_at DESC
    `;

  const [rows] = await db.query(sql, [refID, refID, refID]);
  return rows;
}

// ใน getAllBookings (เพื่อให้นับจำนวนหน้าลิสต์ได้ถูก)
async function getAllBookings(searchDate) {
  const sql = `
    SELECT 
        b.*, 
        (
          CASE 
            WHEN b.is_status = '135' THEN 
              (
                SELECT COUNT(*)
                FROM tb_asset_lists_detail d1
                WHERE d1.refID = b.refID 
                AND d1.is_status IN ('100', '135') 
                AND d1.asset_status = '100' -- ⬅️ ปรับเป็น 100
                AND d1.scan_at = (         
                    SELECT MAX(d2.scan_at)
                    FROM tb_asset_lists_detail d2
                    WHERE d2.refID = d1.refID
                    AND d2.asset_code = d1.asset_code
                )
              )
            WHEN b.is_status = '132' THEN 
              (
                SELECT COUNT(*) 
                FROM tb_asset_lists a 
                WHERE a.refID = b.refID 
                AND a.is_status IN ('100', '132') -- ⬅️ ปรับเป็น 100
              )
            ELSE 
              (SELECT COUNT(*) FROM tb_asset_lists a WHERE a.draft_id = b.draft_id AND a.asset_status = '100') -- ⬅️ ปรับเป็น 100
          END
        ) as attendees,
        s.G_NAME as is_status_name, 
        s.G_DESCRIPT as is_status_color,
        CONCAT(COALESCE(e.titlename_th,''), '', COALESCE(e.firstname_th,''), ' ', COALESCE(e.lastname_th,'')) as created_by_name
    FROM booking_asset_lists b
    LEFT JOIN tb_erp_status s ON b.is_status = s.G_CODE AND s.G_USE = 'A1'
    LEFT JOIN employees e ON b.created_by = e.employee_id
    WHERE b.is_status NOT IN ('133') 
      AND b.booking_type = 'RC'
      AND b.create_date = ? 
    ORDER BY b.created_at DESC
  `;

  const [rows] = await db.query(sql, [searchDate]);
  return rows;
}

// 2. เพิ่มฟังก์ชันสำหรับสถานะ 136 (แก้ไขข้อมูลรับเข้า)
async function editHeaderBooking(draft_id, user_id) {
  const now = getThaiNow();
  await db.query(`
        UPDATE booking_asset_lists SET is_status = '136', updated_by = ?, updated_at = ? WHERE draft_id = ?
    `, [user_id, now, draft_id]);
  return true;
}

// 3. ปรับฟังก์ชัน Finalize (รับเข้าสมบูรณ์ - รวบ 131->135 และ 134->135 ไว้ด้วยกัน)
async function finalizeBooking(draft_id, user_id, headerData = {}) {
  const now = getThaiNow();
  if (headerData.origin && headerData.destination) {
    await db.query(`
            UPDATE booking_asset_lists SET booking_remark = ?, origin = ?, destination = ?, updated_by = ?, updated_at = ?
            WHERE draft_id = ?
        `, [headerData.booking_remark || '', headerData.origin, headerData.destination, user_id, now, draft_id]);
  }

  const [bookingRes] = await db.query(`SELECT is_status, refID, origin, destination FROM booking_asset_lists WHERE draft_id = ?`, [draft_id]);
  const booking = bookingRes[0];
  if (!booking) throw new Error("Booking not found");

  const { refID, origin, destination } = booking;

  // ✅ 1. คัดลอกข้อมูลลง Detail (เพิ่ม current_address)
  const sqlInsertDetail = `
        INSERT INTO tb_asset_lists_detail (
            draft_id, refID, asset_code, asset_detail, asset_type, asset_date,
            doc_no, asset_lot, asset_holder, asset_location,
            asset_width, asset_width_unit, asset_length, asset_length_unit,
            asset_height, asset_height_unit, asset_capacity, asset_capacity_unit,
            asset_weight, asset_weight_unit, asset_img,
            asset_dmg_001, asset_dmg_002, asset_dmg_003, asset_dmg_004, asset_dmg_005, asset_dmg_006,
            asset_remark, asset_usedfor, asset_brand, asset_feature,
            asset_supplier_name, label_register, partCode, print_status,
            asset_status, asset_action, is_status,
            create_date, created_by, created_at, updated_by, updated_at, scan_by, scan_at,
            asset_origin, asset_destination,
            asset_model, asset_responsible_department, asset_source,
            current_address
        )
        SELECT
            t.draft_id, t.refID, t.asset_code, t.asset_detail, t.asset_type, t.asset_date,
            t.doc_no, t.asset_lot, t.asset_holder, t.asset_location,
            t.asset_width, t.asset_width_unit, t.asset_length, t.asset_length_unit,
            t.asset_height, t.asset_height_unit, t.asset_capacity, t.asset_capacity_unit,
            t.asset_weight, t.asset_weight_unit, t.asset_img,
            t.asset_dmg_001, t.asset_dmg_002, t.asset_dmg_003, t.asset_dmg_004, t.asset_dmg_005, t.asset_dmg_006,
            t.asset_remark, t.asset_usedfor, t.asset_brand, t.asset_feature,
            t.asset_supplier_name, t.label_register, t.partCode, t.print_status,
            100, 'รับเข้าสำเร็จ', '135',
            t.create_date, t.created_by, t.created_at, ?, ?, t.scan_by, t.scan_at,
            ?, ?,
            t.asset_model, t.asset_responsible_department, t.asset_source,
            ? 
        FROM tb_asset_lists t
        WHERE t.draft_id = ? AND t.asset_status = 108
    `;
  // ⬅️ 3. ส่ง destination เข้าไป 2 ครั้ง (ครั้งแรกเป็น asset_destination, ครั้งที่สองเป็น current_address)
  await db.query(sqlInsertDetail, [user_id, now, origin, destination, destination, draft_id]);

  // ✅ 2. อัปเดตตารางหลัก tb_asset_lists (เพิ่ม current_address)
  await db.query(`
        UPDATE tb_asset_lists 
        SET asset_status = 100, 
            is_status = '135', 
            current_address = ?,
            updated_by = ?, 
            updated_at = ?, 
            last_used = ? 
        WHERE draft_id = ? AND asset_status = 108
    `, [destination, user_id, now, now, draft_id]);

  // ✅ 3. อัปเดตตารางใบงาน (Header) ให้เป็น 135
  await db.query(`
        UPDATE booking_asset_lists 
        SET is_status = '135', updated_by = ?, updated_at = ? 
        WHERE draft_id = ?
    `, [user_id, now, draft_id]);

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
            updated_by, updated_at, scan_by, scan_at, asset_origin, asset_destination,
            asset_model, asset_responsible_department, asset_source
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?
        )
    `;

  const params = [
    t.draft_id, t.refID, t.asset_code, t.asset_detail, t.asset_type, t.asset_date, t.doc_no, t.asset_lot,
    t.asset_holder, t.asset_location, t.asset_width, t.asset_width_unit, t.asset_length, t.asset_length_unit,
    t.asset_height, t.asset_height_unit, t.asset_capacity, t.asset_capacity_unit, t.asset_weight, t.asset_weight_unit,
    t.asset_img, t.asset_dmg_001, t.asset_dmg_002, t.asset_dmg_003, t.asset_dmg_004, t.asset_dmg_005, t.asset_dmg_006,
    t.asset_remark, t.asset_usedfor, t.asset_brand, t.asset_feature, t.asset_supplier_name, t.label_register,
    t.partCode, t.print_status, t.asset_status, t.asset_action || 'เคลื่อนไหว', t.is_status, t.create_date, t.created_by, t.created_at,
    t.updated_by, t.updated_at, t.scan_by, t.scan_at, origin, destination,
    t.asset_model, t.asset_responsible_department, t.asset_source // ✅ เพิ่ม params 3 ตัวใหม่
  ];
  await db.query(sql, params);
}

async function unlockBooking(draft_id, user_id) {
  const now = getThaiNow();
  // Change logic: Update to status '134' instead of '131'
  await db.query(`
        UPDATE booking_asset_lists
        SET is_status = '134',
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [user_id, now, draft_id]);
  return true;
}

async function scanCheckIn(uniqueKey, draft_id, refID, user_id) {
  const now = getThaiNow();

  // 1. ดึงข้อมูลทรัพย์สินปัจจุบัน (ข้อมูลเดิมก่อนอัปเดต)
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

  // ดึงข้อมูล Origin/Destination จาก Booking Header
  const [bookingRes] = await db.query(`SELECT origin, destination FROM booking_asset_lists WHERE draft_id = ?`, [draft_id]);
  const { origin, destination } = bookingRes[0] || {};

  if (!origin || !destination) {
    return { success: false, code: 'INVALID_BOOKING', message: 'ไม่พบข้อมูลต้นทางหรือปลายทางของใบรับเข้านี้' };
  }

  // ดักจับกรณีสแกนไปแล้วหรือรับเข้าซ้ำ
  if (item.asset_status == 108) {
    if (item.refID === refID) {
      return { success: false, code: 'ALREADY_SCANNED', message: `สแกนกล่องซ้ำ`, data: item };
    } else {
      return { success: false, code: 'INVALID_STATUS', message: `กล่องนี้อยู่ระหว่างการรับเข้าในรายการอื่น`, data: item };
    }
  }

  // ตรวจสอบสถานะต้องเป็น 101 (ระหว่างจัดส่ง) เท่านั้น
  if (item.asset_status != 101) {
    return { success: false, code: 'INVALID_STATUS', message: `กล่องนี้สถานะไม่พร้อมรับเข้า (ต้องเป็นสถานะ 101 เท่านั้น ปัจจุบัน: ${item.asset_status})`, data: item };
  }

  // ตรวจสอบเส้นทาง: tb_asset_lists.asset_destination ต้องตรงกับ booking_asset_lists.origin
  if (item.asset_destination !== origin) {
    return { success: false, code: 'INVALID_ROUTING', message: `ปลายทางของทรัพย์สิน (${item.asset_destination || 'ไม่ระบุ'}) ไม่ตรงกับ "รับเข้าจาก" (${origin})`, data: item };
  }

  // ====================================================================
  // STEP 1: คัดลอกข้อมูลเดิม (คงค่า refID และ draft_id เดิมไว้) ลง tb_asset_lists_detail
  // เปลี่ยนแค่สถานะและบันทึกการกระทำ
  // ====================================================================
  const itemSnapshot = {
    ...item,              // ดึงข้อมูลเดิมทั้งหมด (รวมถึง item.refID และ item.draft_id เดิม)
    is_status: '132',     // อัปเดตสถานะ is_status = 132
    asset_status: 108,    // อัปเดตสถานะ asset_status = 108
    asset_action: 'สแกนรับเข้า',
    scan_by: user_id,
    scan_at: now,
    updated_at: now,
    updated_by: user_id
  };
  await insertSingleDetail(itemSnapshot, origin, destination);

  // ====================================================================
  // STEP 2: อัปเดตทรัพย์สินในตาราง tb_asset_lists (Master) ด้วย refID ใหม่
  // ====================================================================
  await db.query(`
        UPDATE tb_asset_lists 
        SET refID = ?,            -- refID ใหม่จากหน้าจอ (booking_asset_lists)
            asset_status = 108,
            is_status = '132',
            draft_id = ?,         -- draft_id ใหม่
            current_address = ?,  -- อัปเดตที่อยู่ปัจจุบันเป็น destination ของใบเบิก
            scan_by = ?, 
            scan_at = ?,
            updated_by = ?,
            updated_at = ?
        WHERE asset_code = ?
    `, [refID, draft_id, destination, user_id, now, user_id, now, item.asset_code]);

  // ดึงข้อมูลล่าสุดกลับไปอัปเดตหน้าจอ UI
  const [updatedRows] = await db.query(sqlGet, [item.asset_code]);
  return { success: true, code: 'SUCCESS', data: updatedRows[0] };
}

async function returnSingleAsset(assetCode) {
  const now = getThaiNow();
  const [rows] = await db.query(`SELECT a.*, b.is_status as booking_status, b.origin, b.destination FROM tb_asset_lists a LEFT JOIN booking_asset_lists b ON a.draft_id = b.draft_id WHERE a.asset_code = ?`, [assetCode]);
  const item = rows[0];
  if (!item) return null;

  if (item.booking_status === '134') {
    // อัปเดตตารางหลัก 
    await db.query(`UPDATE tb_asset_lists SET asset_status = 100, is_status = '107', draft_id = NULL, refID = NULL, updated_at = ? WHERE asset_code = ?`, [now, assetCode]);

    // ✅ 1. อัปเดต Detail เดิมให้เป็น 107 (ป้องกันค้างดึงมาแสดงตอน 135)
    await db.query(`UPDATE tb_asset_lists_detail SET asset_status = 102, is_status = '107', updated_at = ? WHERE refID = ? AND asset_code = ?`, [now, item.refID, assetCode]);

    // ✅ 2. Insert Detail ประวัติใหม่ระบุ Action เป็น 'ยกเลิกรับเข้า'
    const itemSnapshot = {
      ...item,
      is_status: '107',
      asset_status: 100,
      asset_action: 'ยกเลิกรับเข้า',
      updated_at: now,
      scan_at: now
    };
    await insertSingleDetail(itemSnapshot, item.origin, item.destination);

  } else {
    await db.query(`UPDATE tb_asset_lists SET asset_status = 100, draft_id = NULL, refID = NULL, updated_at = ? WHERE asset_code = ?`, [now, assetCode]);
  }
  await returnToStock([assetCode]);
  return await getAssetWithStatus(assetCode);
}

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
  // ดึงทั้ง code และ name เพื่อนำไปแสดงผลและค้นหา
  const [rows] = await db.query(`
    SELECT 
      supplier_code as code, 
      supplier_name as name 
    FROM suppliers 
    ORDER BY supplier_code ASC
  `);
  return rows;
}

async function getBookingDetail(draft_id) {
  const sql = `SELECT * FROM booking_asset_lists WHERE draft_id = ?`;
  const [rows] = await db.query(sql, [draft_id]);
  return rows[0];
}

async function returnToStock(ids) {
  if (!ids || ids.length === 0) return [];
  const now = getThaiNow();

  for (const assetCode of ids) {
    // 1. ดึงสถานะใบเบิกปัจจุบัน เพื่อดูว่าเป็น 131 หรือ 134
    const [rows] = await db.query(`
          SELECT a.refID as current_refID, b.is_status as booking_status 
          FROM tb_asset_lists a 
          LEFT JOIN booking_asset_lists b ON a.draft_id = b.draft_id 
          WHERE a.asset_code = ?
      `, [assetCode]);

    const currentItem = rows[0];
    const bookingStatus = currentItem?.booking_status;
    const currentRefID = currentItem?.current_refID;

    // 2. วิ่งไปดึง draft_id, refID และ current_address 'ชุดเดิม' จาก Detail
    const sqlGetPrev = `
          SELECT draft_id, refID, current_address 
          FROM tb_asset_lists_detail 
          WHERE asset_code = ? 
            AND asset_status = 108 
            AND is_status = '132' 
          ORDER BY created_at DESC 
          LIMIT 1
      `;
    const [prevRows] = await db.query(sqlGetPrev, [assetCode]);
    const prevData = prevRows[0];

    if (prevData) {
      // 3. อัปเดต Master (tb_asset_lists) ให้กลับไปเป็นสถานะ 101 / 115 ก่อนถูกสแกน
      await db.query(`
              UPDATE tb_asset_lists 
              SET draft_id = ?, 
                  refID = ?, 
                  asset_status = 101, 
                  is_status = '115',
                  current_address = ?, 
                  updated_at = ?
              WHERE asset_code = ?
          `, [prevData.draft_id, prevData.refID, prevData.current_address, now, assetCode]);

      // 4. ถ้าเป็นการยกเลิกตอนสถานะ 134 (ปลดล็อค) 
      // 💡 เปลี่ยนจากการ DELETE เป็น UPDATE ประวัติ 102/135 เป็น 133/133
      if (bookingStatus === '134') {
        await db.query(`
                  UPDATE tb_asset_lists_detail 
                  SET asset_status = 133, 
                      is_status = '133',
                      asset_action = '(ปลดล็อค)ยกเลิกรับเข้า',
                      updated_at = ?
                  WHERE asset_code = ? 
                    AND asset_status = 100 
                    AND is_status = '135' 
                    AND refID = ? 
                  ORDER BY created_at DESC 
                  LIMIT 1
              `, [now, assetCode, currentRefID]);
      }

      // 5. ลบประวัติ 108/132 ใน Detail ทิ้ง (อันนี้ควรลบตามเดิม เพราะถือว่าแค่ถูกดึงลงตะกร้าแล้วดึงกลับ ยังไม่ได้มีผลทางบัญชี)
      await db.query(`
              DELETE FROM tb_asset_lists_detail 
              WHERE asset_code = ? 
                AND asset_status = 108 
                AND is_status = '132' 
              ORDER BY created_at DESC 
              LIMIT 1
          `, [assetCode]);
    } else {
      // กรณีหาประวัติไม่เจอ (Fallback)
      await db.query(`
              UPDATE tb_asset_lists 
              SET asset_status = 101, 
                  is_status = '115',
                  draft_id = NULL, 
                  refID = NULL, 
                  updated_at = ? 
              WHERE asset_code = ?
          `, [now, assetCode]);
    }
  }

  // ดึงข้อมูลที่อัปเดตแล้วกลับไปให้ UI วาดตารางใหม่
  const [updatedRows] = await db.query(`
      SELECT a.*, s1.G_NAME as asset_status_name, s1.G_DESCRIPT as asset_status_color
      FROM tb_asset_lists a
      LEFT JOIN tb_erp_status s1 ON a.asset_status = s1.G_CODE AND s1.G_USE = 'A1'
      WHERE a.asset_code IN (?)
  `, [ids]);

  return updatedRows;
}

async function cancelBooking(draft_id, user_id) {
  const now = getThaiNow();
  const sql = `UPDATE booking_asset_lists SET is_status = '133', updated_by = ?, updated_at = ? WHERE draft_id = ?`;
  await db.query(sql, [user_id, now, draft_id]);
  return true;
}

// src/modules/Smartpackage/systemOut/systemOutModel.js

async function confirmOutput(draft_id, user_id) {
  const now = getThaiNow();

  const [bookingRes] = await db.query(
    `SELECT draft_id FROM booking_asset_lists WHERE draft_id = ? AND is_status = '132'`,
    [draft_id]
  );

  if (bookingRes.length === 0) {
    throw new Error("ไม่พบรายการใบเบิก หรือสถานะไม่ใช่ 'รอตรวจสอบ' (132)");
  }

  await db.query(`
        UPDATE booking_asset_lists
        SET is_status = '135',
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [user_id, now, draft_id]);

  await db.query(`
        UPDATE tb_asset_lists
        SET is_status = '135',
            updated_by = ?,
            updated_at = ?,
            last_used = ?
        WHERE draft_id = ?
    `, [user_id, now, now, draft_id]);

  // ✅ เพิ่มฟิลด์ใหม่ 3 ตัว
  const sqlInsertDetail = `
        INSERT INTO tb_asset_lists_detail (
            draft_id, refID, asset_code, asset_detail, asset_type, asset_date,
            doc_no, asset_lot, asset_holder, asset_location,
            asset_width, asset_width_unit, asset_length, asset_length_unit,
            asset_height, asset_height_unit, asset_capacity, asset_capacity_unit,
            asset_weight, asset_weight_unit, asset_img,
            asset_dmg_001, asset_dmg_002, asset_dmg_003,
            asset_dmg_004, asset_dmg_005, asset_dmg_006,
            asset_remark, asset_usedfor, asset_brand, asset_feature,
            asset_supplier_name, label_register, partCode, print_status,
            asset_status, asset_action, is_status,
            create_date, created_by, created_at,
            updated_by, updated_at, scan_by, scan_at,
            asset_origin, asset_destination,
            asset_model, asset_responsible_department, asset_source
        )
        SELECT
            t.draft_id, t.refID, t.asset_code, t.asset_detail, t.asset_type, t.asset_date,
            t.doc_no, t.asset_lot, t.asset_holder, t.asset_location,
            t.asset_width, t.asset_width_unit, t.asset_length, t.asset_length_unit,
            t.asset_height, t.asset_height_unit, t.asset_capacity, t.asset_capacity_unit,
            t.asset_weight, t.asset_weight_unit, t.asset_img,
            t.asset_dmg_001, t.asset_dmg_002, t.asset_dmg_003,
            t.asset_dmg_004, t.asset_dmg_005, t.asset_dmg_006,
            t.asset_remark, t.asset_usedfor, t.asset_brand, t.asset_feature,
            t.asset_supplier_name, t.label_register, t.partCode, t.print_status,
            t.asset_status, 'ยืนยันรับเข้า', '135', 
            t.create_date, t.created_by, t.created_at,
            ?, ?, t.scan_by, t.scan_at, 
            b.origin, b.destination,
            t.asset_model, t.asset_responsible_department, t.asset_source
        FROM tb_asset_lists t
        LEFT JOIN booking_asset_lists b ON t.draft_id = b.draft_id
        WHERE t.draft_id = ?
    `;

  await db.query(sqlInsertDetail, [user_id, now, draft_id]);

  return true;
}

module.exports = {
  createBooking,
  generateRefID,
  updateBookingHeader,
  finalizeBooking,
  editHeaderBooking,
  unlockBooking,
  scanCheckIn,
  returnSingleAsset,
  getAssetsByDraft,
  getAssetWithStatus,
  getZones,
  getAllBookings,
  getBookingDetail,
  returnToStock,
  cancelBooking,
  getAssetsDetailByRefID,
  getAssetsByMasterRefID,
  confirmOutput
};