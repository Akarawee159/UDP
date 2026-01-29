// src/modules/Smartpackage/systemIn/systemInController.js
'use strict';
const model = require('./systemInModel');

async function initBooking(req, res, next) {
  try {
    const { draft_id, type } = req.body; // รับ type (good/defective)
    const user_id = req.user?.employee_id;
    if (!draft_id) throw new Error("Draft ID required");
    await model.createBooking({ draft_id, created_by: user_id, type }); // ส่ง type ไป model
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
    if (io) io.emit('systemin:update', { action: 'ref_generated', draft_id });

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function confirmBooking(req, res, next) {
  try {
    const { draft_id, booking_remark, origin, destination } = req.body;
    const user_id = req.user?.employee_id;
    if (!draft_id) throw new Error("Draft ID missing");

    const result = await model.updateBookingHeader(draft_id, { booking_remark, origin, destination }, user_id);

    const io = req.app.get('io');
    if (io) io.emit('systemin:update', { action: 'header_update', draft_id });

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function finalizeBooking(req, res, next) {
  try {
    const { draft_id } = req.body;
    const user_id = req.user?.employee_id;
    if (!draft_id) throw new Error("Draft ID missing");

    await model.finalizeBooking(draft_id, user_id);

    const io = req.app.get('io');
    if (io) io.emit('systemin:update', { action: 'finalized', draft_id });

    res.json({ success: true, message: 'Finalized' });
  } catch (err) { next(err); }
}

async function unlockBooking(req, res, next) {
  try {
    const { draft_id } = req.body;
    const user_id = req.user?.employee_id;
    if (!draft_id) throw new Error("Draft ID missing");

    await model.unlockBooking(draft_id, user_id);

    const io = req.app.get('io');
    if (io) io.emit('systemin:update', { action: 'unlocked', draft_id });

    res.json({ success: true, message: 'Unlocked' });
  } catch (err) { next(err); }
}

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
        io.emit('systemin:update', { action: 'scan', data: result.data, draft_id });
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
    const { asset_code, draft_id } = req.body;

    // model จะ throw error ถ้าติด constraint unlock
    const updatedItem = await model.returnSingleAsset(asset_code);

    const io = req.app.get('io');
    if (io && updatedItem) {
      io.emit('systemin:update', { action: 'return', data: updatedItem, draft_id });
      io.emit('registerasset:upsert', updatedItem);
    }
    res.json({ success: true, message: 'Returned' });
  } catch (err) {
    // ส่ง error message กลับไปให้ frontend alert
    res.status(400).json({ success: false, message: err.message });
  }
}

async function returnAssets(req, res, next) {
  try {
    const { ids, draft_id } = req.body;
    const updatedItems = await model.returnToStock(ids);
    const io = req.app.get('io');
    if (io) {
      io.emit('systemin:update', { action: 'return', ids, draft_id });
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
    const assets = await model.getAssetsByDraft(draft_id);
    res.json({ success: true, booking, assets });
  } catch (err) { next(err); }
}

async function cancelBooking(req, res, next) {
  try {
    const { draft_id } = req.body;
    const user_id = req.user?.employee_id;
    if (!draft_id) throw new Error("Draft ID missing");

    const assets = await model.getAssetsByDraft(draft_id);
    // Logic change: Allow cancel even if assets exist? 
    // Usually should force empty cart first, but if prompt says just status change:
    if (assets && assets.length > 0) throw new Error("กรุณายกเลิกรับเข้า (คืนค่า) รายการสินค้าทั้งหมดในตะกร้าก่อน");

    await model.cancelBooking(draft_id, user_id);
    const io = req.app.get('io');
    if (io) io.emit('systemin:update', { action: 'cancel', draft_id });

    res.json({ success: true, message: 'Booking cancelled' });
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
  unlockBooking
};