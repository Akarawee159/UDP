// src/modules/Smartpackage/systemDefective/systemDefectiveModel.js
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
    VALUES (?, ?, ?, '140', ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE updated_at = ?
  `;
  const dateOnly = dayjs(now).format('YYYY-MM-DD');
  const timeOnly = dayjs(now).format('HH:mm:ss');

  await db.query(sql, [
    draft_id, dateOnly, timeOnly, created_by, now,
    objective || null, booking_type || null,
    now
  ]);
  return { draft_id };
}

// DF 
async function generateRefID(draft_id, user_id) {
  const dateStr = dayjs().format('DDMMYY');
  const prefix = `DF${dateStr}`;

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
    const lastRef = rows[0].refID;
    const lastSeqStr = lastRef.substring(lastRef.length - 4);
    const lastSeq = parseInt(lastSeqStr, 10);

    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  const refID = `${prefix}${String(seq).padStart(4, '0')}`;
  const now = getThaiNow();

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

  await db.query(`
        UPDATE booking_asset_lists
        SET booking_remark = ?,
            origin = ?,
            destination = ?,
            is_status = '141', 
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [booking_remark, origin, destination, user_id, now, draft_id]);

  return { success: true };
}

async function finalizeBooking(draft_id, user_id, headerData = {}) {
  const now = getThaiNow();

  // ✅ Step 0: อัปเดต Header (Origin/Destination)
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

  // 1. Get Current Booking Status
  const [bookingRes] = await db.query(`SELECT is_status, refID, origin, destination FROM booking_asset_lists WHERE draft_id = ?`, [draft_id]);
  const booking = bookingRes[0];
  if (!booking) throw new Error("Booking not found");

  const previousStatus = booking.is_status;
  const { refID, origin, destination } = booking;

  // 2. Update Header Status to 142 (Finalized)
  await db.query(`
        UPDATE booking_asset_lists
        SET is_status = '142',
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [user_id, now, draft_id]);

  // 3. Logic Branching
  if (previousStatus === '144') {
    // Logic for Status 144 (Re-Finalize / Merge)
    const [currentAssets] = await db.query(`SELECT * FROM tb_asset_lists WHERE draft_id = ?`, [draft_id]);
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
        const exactMatch = existingRecords.find(ex =>
          dayjs(ex.scan_at).format('YYYY-MM-DD HH:mm:ss') === dayjs(item.scan_at).format('YYYY-MM-DD HH:mm:ss') &&
          ex.scan_by == item.scan_by
        );

        if (exactMatch) {
          matchFound = true;
          if (exactMatch.asset_origin !== origin || exactMatch.asset_destination !== destination) {
            await db.query(`
                UPDATE tb_asset_lists_detail 
                SET asset_origin = ?, asset_destination = ?, updated_at = ?
                WHERE refID = ? AND asset_code = ? AND scan_at = ?
            `, [origin, destination, now, refID, item.asset_code, exactMatch.scan_at]);
          }
        }
      }

      if (!matchFound) {
        await insertSingleDetail(item, origin, destination);
      }
    }

  } else {
    // Logic for Status 141 (First Time Finalize) -> Bulk Insert
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
  await db.query(`
        UPDATE booking_asset_lists
        SET is_status = '144',
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [user_id, now, draft_id]);
  return true;
}

// 🚩 ฟังก์ชัน Scan ที่แก้ไขใหม่
async function scanCheckIn(uniqueKey, draft_id, refID, user_id) {
  const now = getThaiNow();

  // 1. ดึงข้อมูล Asset + Status Detail
  const sqlGetAsset = `
        SELECT a.*, 
               s1.G_NAME as asset_status_name, 
               s1.G_DESCRIPT as asset_status_color
        FROM tb_asset_lists a
        LEFT JOIN tb_erp_status s1 ON a.asset_status = s1.G_CODE AND s1.G_USE = 'A1'
        WHERE a.asset_code = ?
    `;
  const [assetRows] = await db.query(sqlGetAsset, [uniqueKey]);
  const item = assetRows[0];

  if (!item) return { success: false, code: 'NOT_FOUND', message: 'ไม่พบทรัพย์สินนี้' };

  // 2. ดึงข้อมูล Booking Header เพื่อเอาค่า Origin มาเทียบ
  const sqlGetBooking = `SELECT origin FROM booking_asset_lists WHERE draft_id = ?`;
  const [bookingRows] = await db.query(sqlGetBooking, [draft_id]);
  const booking = bookingRows[0];
  if (!booking) return { success: false, code: 'BOOKING_ERROR', message: 'ไม่พบข้อมูลใบรับเข้า' };

  // 🔴 เช็ค: ถ้าอยู่ในตะกร้านี้แล้ว (Status 103 && refID ตรงกัน)
  if (item.asset_status == 103) {
    if (item.refID === refID) {
      return { success: false, code: 'ALREADY_SCANNED', message: `รายการนี้ถูกเบิกขอซ่อมไปแล้วในใบเบิกนี้`, data: item };
    } else {
      return { success: false, code: 'INVALID_STATUS', message: `ไม่สามารถสแกนได้ เนื่องจากสินค้านี้ถูกเบิกขอซ่อมไปแล้ว`, data: item };
    }
  }

  const allowedStatus = ['100', '101']; // 100 = ปกติ, 101 = รอรับเข้า
  if (!allowedStatus.includes(String(item.asset_status))) {
    return {
      success: false,
      code: 'INVALID_STATUS_101',
      // ปรับข้อความแจ้งเตือนให้สอดคล้อง
      message: `ไม่สามารถสแกนรับเข้าได้ เนื่องจากสถานะปัจจุบันไม่ใช่ "ปกติ" (100) หรือ "รอรับเข้า" (101)`,
      data: item
    };
  }

  // เช็ค Origin เฉพาะกรณีที่เป็น 101 เท่านั้น (100 ให้ผ่านเลย)
  if (String(item.asset_status) === '101') {
    // booking.origin (รับเข้าจากปลายทาง) vs item.asset_destination (ปลายทางของสินทรัพย์)
    if (String(booking.origin) !== String(item.asset_destination)) {
      return {
        success: false,
        code: 'INVALID_ORIGIN',
        message: `รับเข้าจากปลายทางไม่ถูกต้อง`,
        data: {
          ...item,
          expected_origin: booking.origin,
          actual_destination: item.asset_destination
        }
      };
    }
  }
  // *หมายเหตุ: ถ้าเป็น 100 โค้ดจะข้าม Loop นี้ไปทำ Update ทันที*

  // ✅ ผ่านเงื่อนไข: ทำการ Update ลงตะกร้า (เปลี่ยน asset_status เป็น 103 ชั่วคราวในตะกร้า)
  await db.query(`
        UPDATE tb_asset_lists 
        SET asset_status = 103,
            is_status = '142',
            draft_id = ?, 
            refID = ?,
            scan_by = ?, 
            scan_at = ?,
            updated_at = ?
        WHERE asset_code = ?
    `, [draft_id, refID, user_id, now, now, item.asset_code]);

  const [updatedRows] = await db.query(sqlGetAsset, [item.asset_code]);
  return { success: true, code: 'SUCCESS', data: updatedRows[0] };
}

async function getOriginalAssetStatus(assetCode) {
  const sql = `
        SELECT asset_status, is_status 
        FROM tb_asset_lists_detail 
        WHERE asset_code = ? 
        ORDER BY scan_at DESC 
        LIMIT 1
    `;
  const [rows] = await db.query(sql, [assetCode]);

  // Default fallback: ถ้าไม่เจอประวัติ ให้ตีเป็นของปกติในคลัง (100) สถานะพร้อมใช้ (103)
  if (rows.length === 0) {
    return { asset_status: 100, is_status: '103' };
  }

  return {
    asset_status: rows[0].asset_status,
    is_status: rows[0].is_status
  };
}

async function returnSingleAsset(assetCode) {
  const now = getThaiNow();

  // 1. Get Asset and Booking Info
  const [rows] = await db.query(`
      SELECT a.*, b.is_status as booking_status, b.origin, b.destination
      FROM tb_asset_lists a
      LEFT JOIN booking_asset_lists b ON a.draft_id = b.draft_id
      WHERE a.asset_code = ?
  `, [assetCode]);

  const item = rows[0];
  if (!item) return null;

  const isBooking26 = item.booking_status === '144'; // กรณีปลดล็อคแก้ไข

  if (isBooking26) {
    // กรณีแก้ไข (144) -> กลับเป็น 101/115 ตาม Logic เดิมที่มี snapshot
    await db.query(`
          UPDATE tb_asset_lists 
          SET asset_status = 101, 
              is_status = '115',
              draft_id = NULL, 
              refID = NULL, 
              updated_at = ?
          WHERE asset_code = ?
      `, [now, assetCode]);

    const itemSnapshot = {
      ...item,
      is_status: '115',
      asset_status: 101,
      updated_at: now,
      scan_at: now
    };
    await insertSingleDetail(itemSnapshot, item.origin, item.destination);

  } else {
    // ✅ กรณีปกติ (141) -> เช็ค History เพื่อคืนค่าเดิม
    const original = await getOriginalAssetStatus(assetCode);

    // กำหนดค่าที่จะ Update ตามเงื่อนไขที่คุณต้องการ
    let targetAssetStatus = 100;
    let targetIsStatus = '103';

    if (String(original.asset_status) === '101') {
      // ถ้าเดิมเป็น 101 -> ให้กลับเป็น 101, is_status=115
      targetAssetStatus = 101;
      targetIsStatus = '115';
    } else {
      // ถ้าเดิมเป็น 100 (หรืออื่นๆ) -> ให้กลับเป็น 100, is_status=ค่าเดิม
      targetAssetStatus = 100;
      targetIsStatus = '121';
      // targetIsStatus = original.is_status;
    }

    await db.query(`
          UPDATE tb_asset_lists 
          SET asset_status = ?, 
              is_status = ?,
              draft_id = NULL, 
              refID = NULL, 
              updated_at = ?
          WHERE asset_code = ?
      `, [targetAssetStatus, targetIsStatus, now, assetCode]);
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
  // JOIN tb_erp_status เพื่อแสดงสีและชื่อสถานะตาม asset_status ปัจจุบัน
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
  const [rows] = await db.query(`
    SELECT 
      supplier_code as code, 
      supplier_name as name 
    FROM suppliers 
    ORDER BY supplier_code ASC
  `);
  return rows;
}

async function getAllBookings(searchDate) {
  const sql = `
    SELECT 
        b.*, 
        (
          CASE 
            WHEN b.is_status = '145' THEN 
              (
                SELECT COUNT(*)
                FROM tb_asset_lists_detail d1
                WHERE d1.refID = b.refID 
                AND d1.is_status IN ('103', '145') 
                AND d1.asset_status = '103'
                AND d1.scan_at = (         
                    SELECT MAX(d2.scan_at)
                    FROM tb_asset_lists_detail d2
                    WHERE d2.refID = d1.refID
                    AND d2.asset_code = d1.asset_code
                )
              )
            WHEN b.is_status = '142' THEN 
              (
                SELECT COUNT(*) 
                FROM tb_asset_lists a 
                WHERE a.refID = b.refID 
                AND a.is_status IN ('103', '142')
              )
            ELSE 
              (SELECT COUNT(*) FROM tb_asset_lists a WHERE a.draft_id = b.draft_id AND a.asset_status = '103')
          END
        ) as attendees,
        
        s.G_NAME as is_status_name, 
        s.G_DESCRIPT as is_status_color,
        CONCAT(COALESCE(e.titlename_th,''), '', COALESCE(e.firstname_th,''), ' ', COALESCE(e.lastname_th,'')) as created_by_name
    FROM booking_asset_lists b
    LEFT JOIN tb_erp_status s ON b.is_status = s.G_CODE AND s.G_USE = 'A1'
    LEFT JOIN employees e ON b.created_by = e.employee_id
    WHERE b.is_status NOT IN ('143') 
      AND b.booking_type = 'DF'
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

  const sqlFetch = `
      SELECT a.*, b.is_status as booking_status, b.origin, b.destination
      FROM tb_asset_lists a
      LEFT JOIN booking_asset_lists b ON a.draft_id = b.draft_id
      WHERE a.asset_code IN (?)
    `;
  const [items] = await db.query(sqlFetch, [ids]);

  const items26 = items.filter(i => i.booking_status === '144');
  const itemsNormal = items.filter(i => i.booking_status !== '144');

  // ✅ 1. จัดการกลุ่มปกติ (Booking Status 140/141)
  if (itemsNormal.length > 0) {
    // ต้องวนลูปเช็ค History ทีละตัว เพื่อความแม่นยำในการคืนสถานะ
    for (const item of itemsNormal) {
      const original = await getOriginalAssetStatus(item.asset_code);

      let targetAssetStatus = 100;
      let targetIsStatus = '103';

      if (String(original.asset_status) === '101') {
        targetAssetStatus = 101;
        targetIsStatus = '115';
      } else {
        targetAssetStatus = 100;
        targetIsStatus = original.is_status;
      }

      await db.query(`
            UPDATE tb_asset_lists 
            SET asset_status = ?,
                is_status = ?,
                draft_id = NULL, 
                refID = NULL, 
                updated_at = ? 
            WHERE asset_code = ?
        `, [targetAssetStatus, targetIsStatus, now, item.asset_code]);
    }
  }

  // 2. จัดการกลุ่มแก้ไข (Booking Status 144) - Logic เดิม
  if (items26.length > 0) {
    const ids26 = items26.map(i => i.asset_code);

    await db.query(`
          UPDATE tb_asset_lists 
          SET asset_status = 100, is_status = '106', draft_id = NULL, refID = NULL, updated_at = ? 
          WHERE asset_code IN (?)
      `, [now, ids26]);

    for (const item of items26) {
      const itemSnapshot = {
        ...item,
        is_status: '106',
        asset_status: 100,
        updated_at: now,
        scan_at: now
      };
      await insertSingleDetail(itemSnapshot, item.origin, item.destination);
    }
  }

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
  const sql = `UPDATE booking_asset_lists SET is_status = '143', updated_by = ?, updated_at = ? WHERE draft_id = ?`;
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
    INNER JOIN (
        SELECT asset_code, MAX(scan_at) as max_scan_at
        FROM tb_asset_lists_detail
        WHERE refID = ? 
        GROUP BY asset_code
    ) latest ON d.asset_code = latest.asset_code AND d.scan_at = latest.max_scan_at
    LEFT JOIN tb_erp_status s ON d.asset_status = s.G_CODE AND s.G_USE = 'A1'
    LEFT JOIN employees e ON d.scan_by = e.employee_id
    WHERE d.refID = ? 
      AND d.is_status IN ('103', '145') 
      AND d.asset_status = '103'
    ORDER BY d.asset_code ASC
  `;
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
      AND a.is_status IN ('103', '142') 
    ORDER BY a.updated_at DESC
  `;
  const [rows] = await db.query(sql, [refID]);
  return rows;
}

// 🚩 ฟังก์ชันยืนยันจ่ายออก (แก้ไขใหม่: Reset ค่า Asset เป็น NULL)
async function confirmOutput(draft_id, user_id) {
  const now = getThaiNow();

  // 1. ตรวจสอบสถานะ Header
  const [bookingRes] = await db.query(
    `SELECT draft_id FROM booking_asset_lists WHERE draft_id = ? AND is_status = '142'`,
    [draft_id]
  );

  if (bookingRes.length === 0) {
    throw new Error("ไม่พบรายการใบเบิก หรือสถานะไม่ใช่ 'รอตรวจสอบ' (142)");
  }

  // 2. อัปเดต Header เป็น 145 (Completed)
  await db.query(`
        UPDATE booking_asset_lists
        SET is_status = '145',
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [user_id, now, draft_id]);

  // 3. บันทึกประวัติลง tb_asset_lists_detail (Snapshot สถานะ 145)
  // *ทำก่อน Update Master เพราะต้องดึงค่าเดิมออกมาบันทึกประวัติ*
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
            t.asset_status, 'ยืนยันเบิกขอซ่อม', '145', 
            t.create_date, t.created_by, t.created_at,
            ?, ?, t.scan_by, t.scan_at,
            b.origin, b.destination
        FROM tb_asset_lists t
        LEFT JOIN booking_asset_lists b ON t.draft_id = b.draft_id
        WHERE t.draft_id = ?
    `;
  await db.query(sqlInsertDetail, [user_id, now, draft_id]);

  // 4. ✅ อัปเดต Master: Reset ค่าเป็นของดีในคลัง (asset_status=145, is_status=103) และเคลียร์ฟิลด์เชื่อมโยงเป็น NULL
  await db.query(`
        UPDATE tb_asset_lists
        SET asset_status = 103,
            is_status = '145',
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [user_id, now, draft_id]);

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