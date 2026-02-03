// src/modules/Smartpackage/systemOut/systemOutController.js
'use strict';
const model = require('./systemOutModel');


async function initBooking(req, res, next) {
  try {
    const { draft_id } = req.body;
    const user_id = req.user?.employee_id;
    if (!draft_id) throw new Error("Draft ID required");
    await model.createBooking({ draft_id, created_by: user_id });

    const io = req.app.get('io');
    if (io) io.emit('systemout:update', { action: 'header_update', draft_id });

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

    // Notify
    const io = req.app.get('io');
    if (io) io.emit('systemout:update', { action: 'ref_generated', draft_id });

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function confirmBooking(req, res, next) {
  try {
    const { draft_id, booking_remark, origin, destination } = req.body;
    const user_id = req.user?.employee_id;
    if (!draft_id) throw new Error("Draft ID missing");

    // บันทึกและเปลี่ยน status -> 111
    const result = await model.updateBookingHeader(draft_id, { booking_remark, origin, destination }, user_id);

    const io = req.app.get('io');
    if (io) io.emit('systemout:update', { action: 'header_update', draft_id });

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// ✅ ใหม่: จ่ายออก (Finalize)
async function finalizeBooking(req, res, next) {
  try {
    // รับค่า booking_remark, origin, destination เพิ่มเข้ามา
    const { draft_id, booking_remark, origin, destination } = req.body;
    const user_id = req.user?.employee_id;

    if (!draft_id) throw new Error("Draft ID missing");

    // ส่ง object ข้อมูล header ไปที่ model
    await model.finalizeBooking(draft_id, user_id, { booking_remark, origin, destination });

    const io = req.app.get('io');
    if (io) io.emit('systemout:update', { action: 'finalized', draft_id });

    res.json({ success: true, message: 'Finalized' });
  } catch (err) { next(err); }
}

// ✅ ใหม่: ปลดล็อค (Unlock)
async function unlockBooking(req, res, next) {
  try {
    const { draft_id } = req.body;
    const user_id = req.user?.employee_id;
    if (!draft_id) throw new Error("Draft ID missing");

    await model.unlockBooking(draft_id, user_id);

    const io = req.app.get('io');
    if (io) io.emit('systemout:update', { action: 'unlocked', draft_id });

    res.json({ success: true, message: 'Unlocked' });
  } catch (err) { next(err); }
}

// ... (scanAsset, returnSingle, returnAssets, getDropdowns, getBookingList, getBookingDetail, cancelBooking คงเดิม) ...
async function scanAsset(req, res, next) {
  try {
    let { qrString, draft_id, refID } = req.body;
    const user_id = req.user?.employee_id;
    if (!qrString || !draft_id || !refID) throw new Error('Invalid Data');

    qrString = qrString.replace(/ฅ/g, '|');
    const parts = qrString.split('|');
    const uniqueId = parts[2];
    if (!uniqueId) throw new Error('QR Code format invalid');

    const result = await model.scanCheckIn(uniqueId, draft_id, refID, user_id);

    if (result.success) {
      const io = req.app.get('io');
      if (io) {
        io.emit('systemout:update', { action: 'scan', data: result.data, draft_id });
        io.emit('registerasset:upsert', result.data);
      }
      res.json({ success: true, data: result.data });
    } else {
      res.json({ success: false, code: result.code, message: result.message, data: result.data });
    }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
}

async function returnSingle(req, res, next) {
  try {
    // ✅ รับ draft_id มาด้วย เพื่อส่งกลับไปให้ Frontend รู้ว่าต้อง refresh ตะกร้าไหน
    const { asset_code, draft_id } = req.body;

    const updatedItem = await model.returnSingleAsset(asset_code);
    const io = req.app.get('io');
    if (io) {
      // ✅ ส่ง draft_id กลับไปใน socket payload
      io.emit('systemout:update', { action: 'return', data: updatedItem, draft_id });
      io.emit('registerasset:upsert', updatedItem);
    }
    res.json({ success: true, message: 'Returned' });
  } catch (err) { next(err); }
}

async function returnAssets(req, res, next) {
  try {
    // ✅ รับ draft_id มาด้วย
    const { ids, draft_id } = req.body;

    const updatedItems = await model.returnToStock(ids);
    const io = req.app.get('io');
    if (io) {
      // ✅ ส่ง draft_id กลับไปใน socket payload
      io.emit('systemout:update', { action: 'return', ids, draft_id });
      updatedItems.forEach(item => io.emit('registerasset:upsert', item));
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
    let assets = [];

    if (booking) {
      const status = String(booking.is_status);

      if (status === '112') {
        // 112 = จ่ายออกแล้ว (History) -> ดึงจาก Detail
        assets = await model.getAssetsDetailByRefID(booking.refID);
      } else if (status === '114') {
        // 114 = ปลดล็อคแก้ไข (Live Editing) -> ดึงจาก Master ด้วย RefID
        // ตามโจทย์: "ดึงข้อมูลที่ tb_asset_lists.refID = booking_asset_lists.refID"
        assets = await model.getAssetsByMasterRefID(booking.refID);
      } else {
        // 110, 111 = Draft -> ดึงจาก Master ด้วย DraftID
        assets = await model.getAssetsByDraft(draft_id);
      }
    }

    res.json({ success: true, booking, assets });
  } catch (err) { next(err); }
}

async function cancelBooking(req, res, next) {
  try {
    const { draft_id } = req.body;
    const user_id = req.user?.employee_id;
    if (!draft_id) throw new Error("Draft ID missing");

    const assets = await model.getAssetsByDraft(draft_id);
    if (assets && assets.length > 0) throw new Error("ไม่สามารถยกเลิกได้ เนื่องจากมีรายการสินค้าค้างอยู่ในใบเบิก");

    await model.cancelBooking(draft_id, user_id);
    const io = req.app.get('io');
    if (io) io.emit('systemout:update', { action: 'cancel', draft_id });

    res.json({ success: true, message: 'Booking cancelled' });
  } catch (err) { next(err); }
}

async function confirmOutput(req, res, next) {
  try {
    const { draft_id } = req.body;
    const user_id = req.user?.employee_id;

    if (!draft_id) throw new Error("Draft ID missing");

    await model.confirmOutput(draft_id, user_id);

    // ส่ง Socket บอกให้หน้าจอร Refesh
    const io = req.app.get('io');
    if (io) io.emit('systemout:update', { action: 'output_confirmed', draft_id });

    res.json({ success: true, message: 'Confirmed Output (Status 115)' });
  } catch (err) { next(err); }
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
  cancelBooking,
  finalizeBooking,
  unlockBooking,
  confirmOutput
};