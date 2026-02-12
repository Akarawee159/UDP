// src/modules/Smartpackage/systemOut/systemOutModel.js
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
    VALUES (?, ?, ?, '110', ?, ?, ?, ?)
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

// RF 
async function generateRefID(draft_id, user_id) {
  const dateStr = dayjs().format('DDMMYY'); // วันที่ปัจจุบัน DDMMYY
  const prefix = `RF${dateStr}`; // Prefix ที่ต้องการค้นหา เช่น RF040226

  // ค้นหา RefID ล่าสุดของวันนี้ ที่ขึ้นต้นด้วย RF เท่านั้น (เพื่อไม่ให้นับรวมเอกสารประเภทอื่น)
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

async function updateBookingHeader(draft_id, body, user_id) {
  const { booking_remark, origin, destination } = body;
  const now = getThaiNow();

  // 1. อัปเดต Header (เหมือนเดิม)
  await db.query(`
        UPDATE booking_asset_lists
        SET booking_remark = ?,
            origin = ?,
            destination = ?,
            is_status = '111', 
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [booking_remark, origin, destination, user_id, now, draft_id]);

  // อัปเดตรายการสินค้าในตะกร้า (tb_asset_lists) ให้เป็นสถานที่ใหม่ตาม Header
  await db.query(`
        UPDATE tb_asset_lists
        SET asset_origin = ?,
            asset_destination = ?,
            updated_at = ?
        WHERE draft_id = ?
  `, [origin, destination, now, draft_id]);

  return { success: true };
}

async function finalizeBooking(draft_id, user_id, headerData = {}) {
  const now = getThaiNow();

  // ✅ Step 0: อัปเดต Header (Origin/Destination) ก่อนเริ่ม Logic ใดๆ 
  // หากมีการส่งค่าเข้ามาจาก Frontend เพื่อให้มั่นใจว่าข้อมูลล่าสุดถูกบันทึกแล้ว
  if (headerData.origin && headerData.destination) {
    const sqlUpdateHeader = `
        UPDATE booking_asset_lists
        SET booking_remark = ?,
            origin = ?,
            destination = ?,
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `;
    await db.query(sqlUpdateHeader, [
      headerData.booking_remark || '',
      headerData.origin,
      headerData.destination,
      user_id,
      now,
      draft_id
    ]);
  }

  // 1. Get Current Booking Status to decide logic
  // (Logic เดิม: ดึงข้อมูลล่าสุด ซึ่งตอนนี้จะได้ค่า Origin/Destination ที่อัปเดตแล้วจาก Step 0)
  const [bookingRes] = await db.query(`SELECT is_status, refID, origin, destination FROM booking_asset_lists WHERE draft_id = ?`, [draft_id]);
  const booking = bookingRes[0];
  if (!booking) throw new Error("Booking not found");

  const previousStatus = booking.is_status;
  const { refID, origin, destination } = booking;

  await db.query(`
        UPDATE tb_asset_lists
        SET asset_origin = ?,
            asset_destination = ?
        WHERE draft_id = ?
  `, [origin, destination, draft_id]);

  // 2. Update Header Status to 112 (Finalized)
  await db.query(`
        UPDATE booking_asset_lists
        SET is_status = '112',
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [user_id, now, draft_id]);

  // 3. Logic Branching (Logic เดิมทั้งหมด ไม่มีการเปลี่ยนแปลง แต่ข้อมูล origin/destination ถูกต้องแล้ว)
  if (previousStatus === '114') {
    // -------------------------------------------------
    // Logic for Status 114 (Re-Finalize / Merge)
    // -------------------------------------------------

    // Get current items in the cart (tb_asset_lists)
    const [currentAssets] = await db.query(`SELECT * FROM tb_asset_lists WHERE draft_id = ?`, [draft_id]);

    // Get existing detail records for this RefID
    const [existingDetails] = await db.query(`SELECT * FROM tb_asset_lists_detail WHERE refID = ?`, [refID]);

    const detailMap = {};
    existingDetails.forEach(d => {
      if (!detailMap[d.asset_code]) detailMap[d.asset_code] = [];
      detailMap[d.asset_code].push(d);
    });

    for (const item of currentAssets) {
      const existingRecords = detailMap[item.asset_code];
      let matchFound = false;

      if (existingRecords && existingRecords.length > 0) {
        // Find if there is an existing record with exact same scan info
        const exactMatch = existingRecords.find(ex =>
          dayjs(ex.scan_at).format('YYYY-MM-DD HH:mm:ss') === dayjs(item.scan_at).format('YYYY-MM-DD HH:mm:ss') &&
          ex.scan_by == item.scan_by
        );

        if (exactMatch) {
          matchFound = true;
          // Check Header info (Origin/Destination)
          // ✅ จุดนี้จะใช้ origin/destination ที่อัปเดตใหม่ ถ้า user แก้ไขมา
          if (exactMatch.asset_origin !== origin || exactMatch.asset_destination !== destination) {
            // Update Origin/Destination in Detail
            await db.query(`
                UPDATE tb_asset_lists_detail 
                SET asset_origin = ?, asset_destination = ?, updated_at = ?
                WHERE refID = ? AND asset_code = ? AND scan_at = ?
            `, [origin, destination, now, refID, item.asset_code, exactMatch.scan_at]);
          }
        }
      }

      // If no exact match found, Insert new record using updated origin/destination
      if (!matchFound) {
        await insertSingleDetail(item, origin, destination);
      }
    }

  } else {
    // -------------------------------------------------
    // Logic for Status 111 (First Time Finalize) -> Bulk Insert
    // -------------------------------------------------
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
            asset_origin, asset_destination
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
            t.asset_status, 'เคลื่อนไหว', t.is_status, 
            t.create_date, t.created_by, t.created_at,
            t.updated_by, t.updated_at, t.scan_by, t.scan_at,
b.origin, b.destination
        FROM tb_asset_lists t
        LEFT JOIN booking_asset_lists b ON t.draft_id = b.draft_id
        WHERE t.draft_id = ?
      `;
    await db.query(sqlInsertDetail, [draft_id]);
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

async function unlockBooking(draft_id, user_id) {
  const now = getThaiNow();
  // Change logic: Update to status '114' instead of '111'
  await db.query(`
        UPDATE booking_asset_lists
        SET is_status = '114',
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [user_id, now, draft_id]);
  return true;
}

async function scanCheckIn(uniqueKey, draft_id, refID, user_id) {
  const now = getThaiNow();

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

  if (item.asset_status == 101) {
    if (item.refID === refID) {
      return { success: false, code: 'ALREADY_SCANNED', message: `รายการนี้ถูกจ่ายออกไปแล้วในใบเบิกนี้`, data: item };
    } else {
      return { success: false, code: 'INVALID_STATUS', message: `ไม่สามารถสแกนได้ เนื่องจากสินค้านี้ถูกจ่ายออกไปแล้ว`, data: item };
    }
  }

  if (item.asset_status != 100) {
    return { success: false, code: 'INVALID_STATUS', message: `ไม่สามารถสแกนได้ เนื่องจากสถานะไม่พร้อมใช้งาน`, data: item };
  }

  // ✅ [เพิ่มใหม่] ดึงข้อมูล Origin/Destination จาก Booking Header
  const [bookingRes] = await db.query(`SELECT origin, destination FROM booking_asset_lists WHERE draft_id = ?`, [draft_id]);
  const { origin, destination } = bookingRes[0] || {};

  // ✅ [แก้ไข] เพิ่ม asset_origin และ asset_destination ในคำสั่ง UPDATE
  await db.query(`
        UPDATE tb_asset_lists 
        SET asset_status = 101,
            is_status = '112',
            draft_id = ?, 
            refID = ?,
            scan_by = ?, 
            scan_at = ?,
            asset_origin = ?,      -- เพิ่ม field
            asset_destination = ?, -- เพิ่ม field
            updated_at = ?
        WHERE asset_code = ?
    `, [draft_id, refID, user_id, now, origin, destination, now, item.asset_code]);

  const [updatedRows] = await db.query(sqlGet, [item.asset_code]);
  return { success: true, code: 'SUCCESS', data: updatedRows[0] };
}

async function returnSingleAsset(assetCode) {
  const now = getThaiNow();

  // 1. Get Asset and Booking Info BEFORE clearing it
  const [rows] = await db.query(`
      SELECT a.*, b.is_status as booking_status, b.origin, b.destination
      FROM tb_asset_lists a
      LEFT JOIN booking_asset_lists b ON a.draft_id = b.draft_id
      WHERE a.asset_code = ?
  `, [assetCode]);

  const item = rows[0];
  if (!item) return null;

  const isBooking26 = item.booking_status === '114';

  // 2. Prepare Updates
  if (isBooking26) {
    // 2a. Update Master Table: status=100, is_status=106, clear booking link
    await db.query(`
          UPDATE tb_asset_lists 
          SET asset_status = 100, 
              is_status = '106',
              draft_id = NULL, 
              refID = NULL, 
              updated_at = ?
          WHERE asset_code = ?
      `, [now, assetCode]);

    // 2b. Insert into Detail (Snapshot of the return)
    const itemSnapshot = {
      ...item,
      is_status: '106',
      asset_status: 100,
      updated_at: now, // Set current time
      scan_at: now     // Set current time
    };
    await insertSingleDetail(itemSnapshot, item.origin, item.destination);

  } else {
    // Normal Return
    await db.query(`
          UPDATE tb_asset_lists 
          SET asset_status = 100, 
              draft_id = NULL, 
              refID = NULL, 
              updated_at = ?
          WHERE asset_code = ?
      `, [now, assetCode]);
  }

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

// ค้นหาฟังก์ชันนี้และแทนที่ด้วย Code ด้านล่าง
async function getAllBookings(searchDate) {
  const sql = `
    SELECT 
        b.*, 
        (
          CASE 
            WHEN b.is_status = '115' THEN 
              (
                SELECT COUNT(*)
                FROM tb_asset_lists_detail d1
                WHERE d1.refID = b.refID 
                AND d1.is_status IN ('101', '115') 
                AND d1.asset_status = '101'
                AND d1.scan_at = (         
                    SELECT MAX(d2.scan_at)
                    FROM tb_asset_lists_detail d2
                    WHERE d2.refID = d1.refID
                    AND d2.asset_code = d1.asset_code
                )
              )
            WHEN b.is_status = '112' THEN 
              (
                SELECT COUNT(*) 
                FROM tb_asset_lists a 
                WHERE a.refID = b.refID 
                AND a.is_status IN ('101', '112')
              )
            ELSE 
              (SELECT COUNT(*) FROM tb_asset_lists a WHERE a.draft_id = b.draft_id AND a.asset_status = '101')
          END
        ) as attendees,
        
        s.G_NAME as is_status_name, 
        s.G_DESCRIPT as is_status_color,
        CONCAT(COALESCE(e.titlename_th,''), '', COALESCE(e.firstname_th,''), ' ', COALESCE(e.lastname_th,'')) as created_by_name
    FROM booking_asset_lists b
    LEFT JOIN tb_erp_status s ON b.is_status = s.G_CODE AND s.G_USE = 'A1'
    LEFT JOIN employees e ON b.created_by = e.employee_id
    WHERE b.is_status NOT IN ('113') 
      AND b.booking_type = 'RF'
      AND b.create_date = ? 
    ORDER BY b.created_at DESC
  `;

  const [rows] = await db.query(sql, [searchDate]);
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

  // 1. Fetch items to check booking status
  const sqlFetch = `
      SELECT a.*, b.is_status as booking_status, b.origin, b.destination
      FROM tb_asset_lists a
      LEFT JOIN booking_asset_lists b ON a.draft_id = b.draft_id
      WHERE a.asset_code IN (?)
    `;
  const [items] = await db.query(sqlFetch, [ids]);

  const items26 = items.filter(i => i.booking_status === '114');
  const itemsNormal = items.filter(i => i.booking_status !== '114');

  // 2. Handle Normal Return
  if (itemsNormal.length > 0) {
    const normalIds = itemsNormal.map(i => i.asset_code);
    await db.query(`
          UPDATE tb_asset_lists 
          SET asset_status = 100, draft_id = NULL, refID = NULL, updated_at = ? 
          WHERE asset_code IN (?)
      `, [now, normalIds]);
  }

  // 3. Handle Status 114 Return (Update & Insert Detail)
  if (items26.length > 0) {
    const ids26 = items26.map(i => i.asset_code);

    // Update Master
    await db.query(`
          UPDATE tb_asset_lists 
          SET asset_status = 100, is_status = '106', draft_id = NULL, refID = NULL, updated_at = ? 
          WHERE asset_code IN (?)
      `, [now, ids26]);

    // Insert Detail for each
    for (const item of items26) {
      const itemSnapshot = {
        ...item,
        is_status: '106',
        asset_status: 100,
        updated_at: now, // Set current time
        scan_at: now     // Set current time
      };
      await insertSingleDetail(itemSnapshot, item.origin, item.destination);
    }
  }

  // Return updated data for UI
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
  const sql = `UPDATE booking_asset_lists SET is_status = '113', updated_by = ?, updated_at = ? WHERE draft_id = ?`;
  await db.query(sql, [user_id, now, draft_id]);
  return true;
}

async function getAssetsDetailByRefID(refID) {
  const sql = `
    SELECT 
      d.*,
      s.G_NAME as status_name,
      s.G_DESCRIPT as status_class,
      CONCAT(COALESCE(e.titlename_th,''), '', COALESCE(e.firstname_th,''), ' ', COALESCE(e.lastname_th,'')) as scan_by_name
    FROM tb_asset_lists_detail d

    LEFT JOIN tb_erp_status s ON d.asset_status = s.G_CODE AND s.G_USE = 'A1'
    LEFT JOIN employees e ON d.scan_by = e.employee_id
    
    WHERE d.refID = ? 
      -- ดึงทั้งสถานะสแกน (101) และ สถานะยืนยันจ่ายออก (115)
      AND d.is_status IN ('101', '115') 
      
      -- และต้องเป็นรายการที่ Asset Status เป็น 101 (ยังถือว่าเป็นของที่จ่ายออก ไม่ใช่ของที่ถูกคืน)
      AND d.asset_status = '101'
      
    ORDER BY d.asset_code ASC
  `;

  // ส่ง refID 2 ครั้ง (ครั้งแรกให้ Subquery, ครั้งสองให้ Main Query)
  const [rows] = await db.query(sql, [refID, refID]);
  return rows;
}

async function getAssetsByMasterRefID(refID) {
  const sql = `
    SELECT 
      a.*,
      s.G_NAME as status_name,
      s.G_DESCRIPT as status_class,
      CONCAT(COALESCE(e.titlename_th,''), '', COALESCE(e.firstname_th,''), ' ', COALESCE(e.lastname_th,'')) as scan_by_name
    FROM tb_asset_lists a
    LEFT JOIN tb_erp_status s ON a.asset_status = s.G_CODE AND s.G_USE = 'A1'
    LEFT JOIN employees e ON a.scan_by = e.employee_id
    WHERE a.refID = ? 
      -- ✅ แก้ไขเงื่อนไข: ดึงรายการที่ is_status เป็น 101 หรือ 112 จากตาราง Master
      AND a.is_status IN ('101', '112') 
    ORDER BY a.updated_at DESC
  `;
  const [rows] = await db.query(sql, [refID]);
  return rows;
}

// src/modules/Smartpackage/systemOut/systemOutModel.js

async function confirmOutput(draft_id, user_id) {
  const now = getThaiNow();

  // 1. ตรวจสอบว่ามีเอกสารสถานะ 112 อยู่จริงหรือไม่ (เพื่อความปลอดภัย)
  const [bookingRes] = await db.query(
    `SELECT draft_id FROM booking_asset_lists WHERE draft_id = ? AND is_status = '112'`,
    [draft_id]
  );

  if (bookingRes.length === 0) {
    throw new Error("ไม่พบรายการใบเบิก หรือสถานะไม่ใช่ 'รอตรวจสอบ' (112)");
  }

  // 2. อัปเดต Header (Booking) เป็นสถานะ 115
  await db.query(`
        UPDATE booking_asset_lists
        SET is_status = '115',
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [user_id, now, draft_id]);

  // 3. อัปเดต Master (Asset Lists) เป็นสถานะ 115
  // ใช้ draft_id เพราะ assets เหล่านั้นยังผูกอยู่กับ draft_id นี้
  await db.query(`
        UPDATE tb_asset_lists
        SET is_status = '115',
            updated_by = ?,
            updated_at = ?,
            last_used = ?
        WHERE draft_id = ?
    `, [user_id, now, now, draft_id]);

  // 4. บันทึกประวัติลง Detail (Snapshot)
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
            asset_origin, asset_destination
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
            t.asset_status, 'ยืนยันจ่ายออก', '115', -- Hardcode Action & Status
            t.create_date, t.created_by, t.created_at,
            ?, ?, t.scan_by, t.scan_at, -- updated_by, updated_at from params
            b.origin, b.destination
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