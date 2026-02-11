'use strict';

const model = require('./supplierModel');

function parsePayload(body) {
  return {
    supplier_code: String(body.supplier_code || '').trim(),
    supplier_code2: String(body.supplier_code2 || '').trim(), // เพิ่มรหัสภายใน
    supplier_type: String(body.supplier_type || '').trim(),
    branch_name: String(body.branch_name || '').trim(),
    supplier_name: String(body.supplier_name || '').trim(),
    remark: String(body.remark || '').trim(),
    supplier_address: String(body.supplier_address || '').trim(),
    contact_name: String(body.contact_name || '').trim(),
    supplier_phone: String(body.supplier_phone || '').trim(),
    contact_phone: String(body.contact_phone || '').trim(),
    tax_id: String(body.tax_id || '').trim(),
  };
}

async function getAll(_req, res, next) {
  try {
    const rows = await model.getAll();
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function getByCode(req, res, next) {
  try {
    const code = req.params.code; // ไม่ต้อง Number() แล้ว เพราะเป็น String
    const row = await model.getByCode(code);
    if (!row) {
      const err = new Error('ไม่พบข้อมูล');
      err.status = 404;
      throw err;
    }
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
}

// API สำหรับ Check Real-time
async function checkDuplicate(req, res, next) {
  try {
    const field = req.query.field || 'supplier_code'; // รับ field ที่จะเช็ค
    const value = String(req.query.value || '').trim();
    const excludeCode = req.query.excludeCode || null;

    if (!value) return res.json({ exists: false });

    const exists = await model.checkDuplicate(field, value, excludeCode);
    res.json({ exists: exists });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const payload = parsePayload(req.body);
    if (!payload.supplier_code) throw new Error('กรุณาระบุรหัสผู้ขาย (ภายนอก)');
    if (!payload.supplier_name) throw new Error('กรุณาระบุชื่อบริษัท');

    // เช็คซ้ำทั้ง 2 รหัส
    if (await model.checkDuplicate('supplier_code', payload.supplier_code)) {
      throw new Error(`รหัสภายนอก ${payload.supplier_code} มีอยู่แล้ว`);
    }
    if (payload.supplier_code2 && await model.checkDuplicate('supplier_code2', payload.supplier_code2)) {
      throw new Error(`รหัสภายใน ${payload.supplier_code2} มีอยู่แล้ว`);
    }

    const newCode = await model.create(payload);
    const row = await model.getByCode(newCode);

    const io = req.app.get('io');
    if (io) io.emit('supplier:upsert', row);

    res.status(201).json({ success: true, data: row, message: 'เพิ่มข้อมูลสำเร็จ' });
  } catch (err) {
    err.status = 409;
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const oldCode = req.params.code; // Code เดิมจาก URL
    const exist = await model.getByCode(oldCode);
    if (!exist) {
      const err = new Error('ไม่พบข้อมูล');
      err.status = 404;
      throw err;
    }

    const payload = parsePayload(req.body);

    // เช็คซ้ำ (exclude ตัวเองด้วย oldCode)
    if (await model.checkDuplicate('supplier_code', payload.supplier_code, oldCode)) {
      throw new Error(`รหัสภายนอก ${payload.supplier_code} ซ้ำกับข้อมูลอื่น`);
    }
    if (payload.supplier_code2 && await model.checkDuplicate('supplier_code2', payload.supplier_code2, oldCode)) {
      throw new Error(`รหัสภายใน ${payload.supplier_code2} ซ้ำกับข้อมูลอื่น`);
    }

    const ok = await model.update(oldCode, payload);
    if (!ok) throw new Error('อัปเดตไม่สำเร็จ');

    // ดึงข้อมูลใหม่ด้วย Code ใหม่ (เผื่อมีการเปลี่ยน Code)
    const row = await model.getByCode(payload.supplier_code);

    const io = req.app.get('io');
    if (io) io.emit('supplier:upsert', { ...row, oldCode: oldCode }); // ส่ง oldCode กลับไปบอก Frontend ให้ลบตัวเก่าถ้า Code เปลี่ยน

    res.json({ success: true, data: row, message: 'อัปเดตข้อมูลสำเร็จ' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const code = req.params.code;
    const ok = await model.remove(code);
    if (!ok) {
      const err = new Error('ลบไม่สำเร็จ หรือไม่พบข้อมูล');
      err.status = 404;
      throw err;
    }

    const io = req.app.get('io');
    if (io) io.emit('supplier:delete', { supplier_code: code });

    res.json({ success: true, message: 'ลบข้อมูลสำเร็จ' });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      err.status = 409;
      err.message = 'ไม่สามารถลบได้ เนื่องจากมีการอ้างอิงอยู่';
    }
    next(err);
  }
}

module.exports = {
  getAll,
  getByCode,
  checkDuplicate,
  create,
  update,
  remove,
};