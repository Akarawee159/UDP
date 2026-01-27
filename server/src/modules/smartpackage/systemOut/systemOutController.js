// src/modules/Smartpackage/systemOut/systemOutController.js
'use strict';

const model = require('./systemOutModel');

// ... (getScannedList เหมือนเดิม) ...
async function getScannedList(req, res, next) {
  try {
    const rows = await model.getScannedAssets();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// รับค่า Scan QR Code
async function scanAsset(req, res, next) {
  try {
    let { qrString } = req.body; // เปลี่ยน const เป็น let
    if (!qrString) throw new Error('Invalid QR Data');

    // ✅ เพิ่ม: แปลง ฅ เป็น | ที่ฝั่ง Server ด้วย (เผื่อ Frontend หลุดมา)
    qrString = qrString.replace(/ฅ/g, '|');

    const parts = qrString.split('|');
    const uniqueId = parts[2]; // Index 2 คือ asset_code (400-00016-0000001)

    if (!uniqueId) throw new Error('QR Code format invalid');
    const result = await model.scanCheckIn(uniqueId);

    if (result.success) {
      const io = req.app.get('io');
      if (io) {
        // 1. แจ้งหน้า SystemOut (ตัวเดิม)
        io.emit('systemout:update', { action: 'scan', data: result.data });

        // ✅ 2. เพิ่มบรรทัดนี้: แจ้งหน้า RegisterAsset และ AssetDetail ให้รู้ว่าสถานะเปลี่ยนแล้ว
        // ข้อมูล result.data ตอนนี้มี asset_status_name/color ครบแล้วจาก Model ที่แก้
        io.emit('registerasset:upsert', result.data);
      }
      res.json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// คืนคลัง
async function returnAssets(req, res, next) {
  try {
    const { ids } = req.body;
    // model.returnToStock ที่แก้ใหม่ จะ return รายการสินค้าที่ถูกอัปเดตกลับมา
    const updatedItems = await model.returnToStock(ids);

    const io = req.app.get('io');
    if (io) {
      // 1. แจ้งหน้า SystemOut (ตัวเดิม)
      io.emit('systemout:update', { action: 'return', ids });

      // ✅ 2. เพิ่ม Loop: แจ้งหน้า RegisterAsset/AssetDetail ทีละรายการ
      updatedItems.forEach(item => {
        io.emit('registerasset:upsert', item);
      });
    }

    res.json({ success: true, message: 'Returned to stock' });
  } catch (err) {
    next(err);
  }
}

// ... (getDropdowns เหมือนเดิม) ...
async function getDropdowns(req, res, next) {
  try {
    const zones = await model.getZones();
    res.json({ success: true, zones });
  } catch (err) { next(err); }
}


module.exports = {
  getScannedList,
  scanAsset,
  returnAssets,
  getDropdowns
};