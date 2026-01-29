// src/modules/Smartpackage/systemIn/systemInModel.js
'use strict';

const db = require('../../../config/database');
const dayjs = require('dayjs');

// ✅ Helper: สร้างเวลาปัจจุบันเป็น Timezone ไทย (UTC+7)
const getThaiNow = () => {
  return dayjs().add(7, 'hour').format('YYYY-MM-DD HH:mm:ss');
};

async function createBooking(data) {
  const { draft_id, created_by } = data;
  const now = getThaiNow();
  const sql = `
    INSERT INTO booking_asset_lists 
    (draft_id, create_date, create_time, is_status, created_by, created_at)
    VALUES (?, ?, ?, '16', ?, ?)
    ON DUPLICATE KEY UPDATE updated_at = ?
  `;
  const dateOnly = dayjs(now).format('YYYY-MM-DD');
  const timeOnly = dayjs(now).format('HH:mm:ss');

  await db.query(sql, [draft_id, dateOnly, timeOnly, created_by, now, now]);
  return { draft_id };
}

// RC = Recieve
async function generateRefID(draft_id, user_id) {
  const [countRes] = await db.query(`SELECT COUNT(*) as cnt FROM booking_asset_lists WHERE create_date = CURDATE()`);
  const seq = countRes[0].cnt + 1;
  const dateStr = dayjs().format('DDMMYY');
  const refID = `RC${dateStr}${String(seq).padStart(4, '0')}`;
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
            is_status = '17', 
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [booking_remark, origin, destination, user_id, now, draft_id]);

  return { success: true };
}

async function finalizeBooking(draft_id, user_id) {
  const now = getThaiNow();

  // 1. Get Current Booking Status to decide logic
  const [bookingRes] = await db.query(`SELECT is_status, refID, origin, destination FROM booking_asset_lists WHERE draft_id = ?`, [draft_id]);
  const booking = bookingRes[0];
  if (!booking) throw new Error("Booking not found");

  const previousStatus = booking.is_status;
  const { refID, origin, destination } = booking;

  // 2. Update Header Status to 18 (Finalized)
  await db.query(`
        UPDATE booking_asset_lists
        SET is_status = '18',
            updated_by = ?,
            updated_at = ?
        WHERE draft_id = ?
    `, [user_id, now, draft_id]);

  // 3. Logic Branching
  if (previousStatus === '26') {
    // -------------------------------------------------
    // Logic for Status 26 (Re-Finalize / Merge)
    // -------------------------------------------------

    // Get current items in the cart (tb_asset_lists)
    const [currentAssets] = await db.query(`SELECT * FROM tb_asset_lists WHERE draft_id = ?`, [draft_id]);

    // Get existing detail records for this RefID
    const [existingDetails] = await db.query(`SELECT * FROM tb_asset_lists_detail WHERE refID = ?`, [refID]);

    // Create a map for fast lookup of existing details by asset_code
    // Note: If multiple details exist for same asset (e.g. return & rescan), this logic might need refinement, 
    // but assuming standard flow, we match by asset_code first.
    // Better to filter specifically when looping.
    const detailMap = {};
    existingDetails.forEach(d => {
      // Store array in case multiple records exist for same asset (though unlikely to have same asset active multiple times without return)
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
          if (exactMatch.asset_origin !== origin || exactMatch.asset_destination !== destination) {
            // Update Origin/Destination in Detail
            await db.query(`
                UPDATE tb_asset_lists_detail 
                SET asset_origin = ?, asset_destination = ?, updated_at = ?
                WHERE refID = ? AND asset_code = ? AND scan_at = ?
            `, [origin, destination, now, refID, item.asset_code, exactMatch.scan_at]);
          }
          // If everything matches, do nothing.
        }
      }

      // If no exact match found (New Item OR Scan Time/User changed), Insert new record
      if (!matchFound) {
        await insertSingleDetail(item, origin, destination);
      }
    }

  } else {
    // -------------------------------------------------
    // Logic for Status 17 (First Time Finalize) -> Bulk Insert
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
            t.asset_status, 'จ่ายออก', t.is_status, 
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
            ?, ?, ?, 'จ่ายออก', ?, ?, ?, ?,
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
  // Change logic: Update to status '26' instead of '17'
  await db.query(`
        UPDATE booking_asset_lists
        SET is_status = '26',
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
        LEFT JOIN tb_erp_status s1 ON a.asset_status = s1.G_CODE AND s1.G_USE = 'A2'
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
            is_status = '18',
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

  const isBooking26 = item.booking_status === '26';

  // 2. Prepare Updates
  if (isBooking26) {
    // 2a. Update Master Table: status=10, is_status=25, clear booking link
    await db.query(`
          UPDATE tb_asset_lists 
          SET asset_status = 10, 
              is_status = '25',
              draft_id = NULL, 
              refID = NULL, 
              scan_by = NULL, 
              scan_at = NULL, 
              updated_at = ?
          WHERE asset_code = ?
      `, [now, assetCode]);

    // 2b. Insert into Detail (Snapshot of the return)
    const itemSnapshot = {
      ...item,
      is_status: '25',
      asset_status: 10,
      updated_at: now, // Set current time
      scan_at: now     // Set current time
    };
    await insertSingleDetail(itemSnapshot, item.origin, item.destination);

  } else {
    // Normal Return
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
  }

  return await getAssetWithStatus(assetCode);
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
    WHERE b.is_status != '16' AND b.is_status != '17' AND b.is_status != '18' AND b.is_status != '19'
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
  const now = getThaiNow();

  // 1. Fetch items to check booking status
  const sqlFetch = `
      SELECT a.*, b.is_status as booking_status, b.origin, b.destination
      FROM tb_asset_lists a
      LEFT JOIN booking_asset_lists b ON a.draft_id = b.draft_id
      WHERE a.asset_code IN (?)
    `;
  const [items] = await db.query(sqlFetch, [ids]);

  const items26 = items.filter(i => i.booking_status === '26');
  const itemsNormal = items.filter(i => i.booking_status !== '26');

  // 2. Handle Normal Return
  if (itemsNormal.length > 0) {
    const normalIds = itemsNormal.map(i => i.asset_code);
    await db.query(`
          UPDATE tb_asset_lists 
          SET asset_status = 10, draft_id = NULL, refID = NULL, updated_at = ? 
          WHERE asset_code IN (?)
      `, [now, normalIds]);
  }

  // 3. Handle Status 26 Return (Update & Insert Detail)
  if (items26.length > 0) {
    const ids26 = items26.map(i => i.asset_code);

    // Update Master
    await db.query(`
          UPDATE tb_asset_lists 
          SET asset_status = 10, is_status = '25', draft_id = NULL, refID = NULL, updated_at = ? 
          WHERE asset_code IN (?)
      `, [now, ids26]);

    // Insert Detail for each
    for (const item of items26) {
      const itemSnapshot = {
        ...item,
        is_status: '25',
        asset_status: 10,
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
      LEFT JOIN tb_erp_status s1 ON a.asset_status = s1.G_CODE AND s1.G_USE = 'A2'
      WHERE a.asset_code IN (?)
  `, [ids]);
  return updatedRows;
}

async function cancelBooking(draft_id, user_id) {
  const now = getThaiNow();
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