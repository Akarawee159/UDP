// src/modules/Smartpackage/systemOut/systemOutController.js
'use strict';
const model = require('./systemOutModel');

// ... (initBooking, getScannedList, generateBookingRef คงเดิม)
async function initBooking(req, res, next) {
  try {
    const { draft_id } = req.body;
    const user_id = req.user?.employee_id;
    if (!draft_id) throw new Error("Draft ID required");
    await model.createBooking({ draft_id, created_by: user_id });
    res.json({ success: true, message: 'Draft initialized' });
  } catch (err) { next(err); }
}

async function getScannedList(req, res, next) {
  try {
    const { draft_id } = req.query;
    if (!draft_id) return res.json({ success: true, data: [] });
    const rows = await model.getAssetsByDraft(draft_id);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function generateBookingRef(req, res, next) {
  try {
    const { draft_id } = req.body;
    const user_id = req.user?.employee_id;
    if (!draft_id) throw new Error("Draft ID missing");
    const result = await model.generateRefID(draft_id, user_id);
    const io = req.app.get('io');
    if (io) io.emit('systemout:update', { action: 'confirm', draft_id });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// ✅ Confirm / Save Booking Header (บันทึกข้อมูล/ปิด)
async function confirmBooking(req, res, next) {
  try {
    const { draft_id, booking_remark, origin, destination } = req.body; // รับ origin, destination
    const user_id = req.user?.employee_id;

    if (!draft_id) throw new Error("Draft ID missing");

    // เรียกฟังก์ชันใหม่ updateBookingHeader
    const result = await model.updateBookingHeader(draft_id, { booking_remark, origin, destination }, user_id);

    const io = req.app.get('io');
    if (io) {
      io.emit('systemout:update', { action: 'header_update', draft_id });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Scan QR
async function scanAsset(req, res, next) {
  try {
    let { qrString, draft_id, refID } = req.body;
    const user_id = req.user?.employee_id;

    if (!qrString || !draft_id || !refID) throw new Error('Invalid Data (RefID required)');

    qrString = qrString.replace(/ฅ/g, '|');
    const parts = qrString.split('|');
    const uniqueId = parts[2];

    if (!uniqueId) throw new Error('QR Code format invalid');

    const result = await model.scanCheckIn(uniqueId, draft_id, refID, user_id);

    if (result.success) {
      const io = req.app.get('io');
      if (io) {
        // 1. แจ้งหน้า SystemOutList (รายการในตะกร้า)
        io.emit('systemout:update', { action: 'scan', data: result.data, draft_id });

        // ✅ 2. แจ้งหน้า RegisterAsset (ทะเบียนทรัพย์สิน) เพื่อเปลี่ยนสีสถานะทันที
        io.emit('registerasset:upsert', result.data);
      }
      res.json({ success: true, data: result.data });
    } else {
      res.json({
        success: false,
        code: result.code,
        message: result.message,
        data: result.data
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ... (returnSingle, returnAssets, getDropdowns, getBookingList, getBookingDetail คงเดิม)
async function returnSingle(req, res, next) {
  try {
    const { asset_code } = req.body;
    const updatedItem = await model.returnSingleAsset(asset_code); // คืนค่า status 10

    const io = req.app.get('io');
    if (io) {
      // 1. แจ้งหน้า SystemOutList
      io.emit('systemout:update', { action: 'return', data: updatedItem });

      // ✅ 2. แจ้งหน้า RegisterAsset เพื่อเปลี่ยนสีสถานะกลับเป็นว่าง
      io.emit('registerasset:upsert', updatedItem);
    }
    res.json({ success: true, message: 'Returned' });
  } catch (err) { next(err); }
}

async function returnAssets(req, res, next) {
  try {
    const { ids } = req.body;
    const updatedItems = await model.returnToStock(ids);

    const io = req.app.get('io');
    if (io) {
      io.emit('systemout:update', { action: 'return', ids });

      // ✅ 3. Loop แจ้งหน้า RegisterAsset ทุกรายการที่ถูกคืน
      updatedItems.forEach(item => {
        io.emit('registerasset:upsert', item);
      });
    }
    res.json({ success: true, message: 'Returned to stock' });
  } catch (err) { next(err); }
}

async function getDropdowns(req, res, next) {
  try {
    const zones = await model.getZones();
    res.json({ success: true, zones });
  } catch (err) { next(err); }
}

async function getBookingList(req, res, next) {
  try {
    const rows = await model.getAllBookings();
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function getBookingDetail(req, res, next) {
  try {
    const { draft_id } = req.query;
    if (!draft_id) throw new Error("Draft ID required");
    const booking = await model.getBookingDetail(draft_id);
    const assets = await model.getAssetsByDraft(draft_id);
    res.json({ success: true, booking, assets });
  } catch (err) { next(err); }
}

// ✅ ยกเลิกใบเบิก (Cancel Booking)
async function cancelBooking(req, res, next) {
  try {
    const { draft_id } = req.body;
    const user_id = req.user?.employee_id;

    if (!draft_id) throw new Error("Draft ID missing");

    // 1. ตรวจสอบว่ามีรายการค้างในตะกร้าหรือไม่ (ใช้ function เดิมที่มีอยู่แล้ว)
    const assets = await model.getAssetsByDraft(draft_id);
    // getAssetsByDraft ดึงของที่มี status 16 (หรือถ้าแก้แล้วดึงทั้งหมด ให้เช็คว่ามี item หรือไม่)
    // แต่ตาม Logic ถ้า status=11 (จ่ายแล้ว) หรือ 16 (draft) ก็ถือว่ามีของ ห้ามยกเลิก
    // เนื่องจาก getAssetsByDraft ใน Model ปัจจุบันดึงทุกสถานะที่ผูกกับ draft_id
    if (assets && assets.length > 0) {
      throw new Error("ไม่สามารถยกเลิกได้ เนื่องจากมีรายการสินค้าค้างอยู่ในใบเบิก");
    }

    // 2. อัปเดตสถานะเป็น 17
    await model.cancelBooking(draft_id, user_id);

    // 3. Notify Socket ให้หน้าจอหลัก refresh
    const io = req.app.get('io');
    if (io) {
      io.emit('systemout:update', { action: 'cancel', draft_id });
    }

    res.json({ success: true, message: 'Booking cancelled' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  initBooking,
  getScannedList,
  scanAsset,
  returnAssets,
  returnSingle,
  confirmBooking,
  getDropdowns,
  getBookingList,
  getBookingDetail,
  generateBookingRef,
  cancelBooking
};