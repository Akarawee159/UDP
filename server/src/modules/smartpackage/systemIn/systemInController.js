// src/modules/Smartpackage/systemIn/systemInController.js
'use strict';
const model = require('./systemInModel');
const dayjs = require('dayjs');
const { generateUsagePDF } = require('./inPDF');

async function initBooking(req, res, next) {
  try {
    // รับค่า objective จาก Frontend หรือกำหนด Default
    const { draft_id, objective = 'ทำรายการรับเข้า' } = req.body;
    const user_id = req.user?.employee_id;

    if (!draft_id) throw new Error("Draft ID required");

    // ✅ 1.2 กำหนด Logic booking_type ตามเงื่อนไข
    let booking_type = null;
    if (objective === 'ทำรายการรับเข้า') {
      booking_type = 'RC';
    }

    // ส่งค่าไปบันทึก
    await model.createBooking({
      draft_id,
      created_by: user_id,
      objective,
      booking_type
    });

    const io = req.app.get('io');
    if (io) io.emit('systemin:update', { action: 'header_update', draft_id });

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

// เพิ่มฟังก์ชันใหม่
async function editHeader(req, res, next) {
  try {
    const { draft_id } = req.body;
    const user_id = req.user?.employee_id;
    if (!draft_id) throw new Error("Draft ID missing");
    await model.editHeaderBooking(draft_id, user_id);
    const io = req.app.get('io');
    if (io) io.emit('systemin:update', { action: 'header_update', draft_id });
    res.json({ success: true, message: 'Status updated to 136' });
  } catch (err) { next(err); }
}

// นำฟังก์ชันนี้ไปแทนที่ของเดิม (เพื่อส่ง refID กลับไปให้ UI ทันทีตอนเซฟ Header)
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

// ✅ ใหม่: รับเข้า (Finalize)
async function finalizeBooking(req, res, next) {
  try {
    // รับค่า booking_remark, origin, destination เพิ่มเข้ามา
    const { draft_id, booking_remark, origin, destination } = req.body;
    const user_id = req.user?.employee_id;

    if (!draft_id) throw new Error("Draft ID missing");

    // ส่ง object ข้อมูล header ไปที่ model
    await model.finalizeBooking(draft_id, user_id, { booking_remark, origin, destination });

    const io = req.app.get('io');
    if (io) io.emit('systemin:update', { action: 'finalized', draft_id });

    res.json({ success: true, message: 'Finalized' });
  } catch (err) { next(err); }
}

// ✅ ใหม่: ปลดล็อค (Unlock)
async function unlockBooking(req, res, next) {
  try {
    const { draft_id } = req.body;
    const user_id = req.user?.employee_id;
    if (!draft_id) throw new Error("Draft ID missing");

    // --- 1. ตรวจสอบเงื่อนไขก่อนปลดล็อค ---
    const booking = await model.getBookingDetail(draft_id);
    if (booking && booking.refID) {
      // ดึงรายการในตะกร้าที่มี refID ตรงกัน และสถานะเป็น 108
      const assets108 = await model.getUnlockedAssetsByRefID(booking.refID);

      // ถ้าไม่มีรายการ 108 อยู่เลย ให้ตีกลับการทำงานทันที
      if (!assets108 || assets108.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'ไม่อนุญาติให้แก้ไข เนื่องไม่พบรายการ'
        });
      }
    }
    // ------------------------------------

    // 2. ถ้ามีรายการผ่านเงื่อนไข ค่อยดำเนินการปลดล็อค (134)
    await model.unlockBooking(draft_id, user_id);

    const io = req.app.get('io');
    if (io) io.emit('systemin:update', { action: 'unlocked', draft_id });

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
    // ✅ รับ draft_id มาด้วย เพื่อส่งกลับไปให้ Frontend รู้ว่าต้อง refresh ตะกร้าไหน
    const { asset_code, draft_id } = req.body;

    const updatedItem = await model.returnSingleAsset(asset_code);
    const io = req.app.get('io');
    if (io) {
      // ✅ ส่ง draft_id กลับไปใน socket payload
      io.emit('systemin:update', { action: 'return', data: updatedItem, draft_id });
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
    const { startDate, endDate } = req.query;

    // ตั้งค่าเริ่มต้น: วันแรกของเดือนปัจจุบัน ถึง วันสุดท้ายของเดือนปัจจุบัน
    const sDate = startDate || dayjs().startOf('month').format('YYYY-MM-DD');
    const eDate = endDate || dayjs().endOf('month').format('YYYY-MM-DD');

    const rows = await model.getAllBookings(sDate, eDate);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function getBookingDetail(req, res, next) {
  try {
    const { draft_id } = req.query;
    if (!draft_id) throw new Error("Draft ID required");

    const booking = await model.getBookingDetail(draft_id);
    let assets = [];
    let hasActiveItems = false; // ✅ 1. เพิ่ม Flag เช็คสถานะ 108

    if (booking) {
      const status = String(booking.is_status);

      if (status === '135') {
        // ✅ 2. เช็คว่ามีของที่ยังรอรับเข้า (108) ค้างในตาราง Master ไหม
        const masterAssets = await model.getUnlockedAssetsByRefID(booking.refID);

        if (masterAssets && masterAssets.length > 0) {
          assets = masterAssets;
          hasActiveItems = true; // มีของจริง (ปลดล็อคได้)
        } else {
          assets = await model.getAssetsDetailByRefID(booking.refID);
          hasActiveItems = false; // ไม่มีของจริง โชว์แค่ประวัติ (ปลดล็อคไม่ได้)
        }
      } else if (status === '134') {
        assets = await model.getUnlockedAssetsByRefID(booking.refID);
        hasActiveItems = assets.length > 0;
      } else if (status === '131' || status === '136') {
        assets = await model.getAssetsByMasterRefID(booking.refID);
        hasActiveItems = assets.length > 0;
      } else {
        assets = await model.getAssetsByDraft(draft_id);
        hasActiveItems = assets.length > 0;
      }
    }
    // ✅ 3. ส่ง hasActiveItems กลับไปให้ Frontend
    res.json({ success: true, booking, assets, hasActiveItems });
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
    if (io) io.emit('systemin:update', { action: 'cancel', draft_id });

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
    if (io) io.emit('systemin:update', { action: 'output_confirmed', draft_id });

    res.json({ success: true, message: 'Confirmed Output (Status 135)' });
  } catch (err) { next(err); }
}

async function printUsagePDF(req, res, next) {
  try {
    const { ids, draft_id } = req.body;
    const user_id = req.user?.employee_id;
    if (!ids || ids.length === 0) throw new Error("ไม่พบรายการที่เลือก");

    const booking = await model.getBookingDetail(draft_id);

    const origin = booking ? booking.origin : '-';
    const destination = booking ? booking.destination : '-';

    // 📌 ดึงวันที่และเวลาเบิกใช้งานมาจัดฟอร์แมต
    const createDate = booking?.create_date ? dayjs(booking.create_date).format('DD/MM/YYYY') : '-';
    const createTime = booking?.create_time ? booking.create_time : '-';

    const items = await model.getAssetsForPrint(ids);
    const printByName = await model.getUserFullName(user_id);

    // 📌 ส่ง createDate และ createTime เข้าไปในฟังก์ชัน
    const pdfBuffer = await generateUsagePDF(items, origin, destination, printByName, createDate, createTime);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
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
  editHeader,
  getBookingDetail,
  cancelBooking,
  finalizeBooking,
  unlockBooking,
  confirmOutput,
  printUsagePDF
};