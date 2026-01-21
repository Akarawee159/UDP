// src/modules/settings/material/materialController.js
'use strict';

const model = require('./materialModel');
const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '../../../img/material');

// ... (functions deleteFile, parsePayload, ensureRequired เหมือนเดิม ไม่ต้องแก้) ...

/** Helper: ลบไฟล์ออกจาก Server */
function deleteFile(filename) {
  if (!filename) return;
  const filePath = path.join(uploadDir, filename);
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (!err) {
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error(`Failed to delete file: ${filename}`, unlinkErr);
        else console.log(`Deleted file: ${filename}`);
      });
    }
  });
}

/** helper: trim และ validate payload */
function parsePayload(body, file) {
  // ... (logic status เดิม) ...
  let status = 2;
  if (body.is_status === 'true' || body.is_status === true || body.is_status === '1' || body.is_status === 1) {
    status = 1;
  }

  // Helper สำหรับแปลงตัวเลข (ถ้าว่างให้เป็น null หรือ 0 ตามต้องการ)
  const parseNum = (val) => (val === '' || val === null || val === undefined) ? null : Number(val);
  const parseStr = (val) => String(val || '').trim();

  const data = {
    material_code: parseStr(body.material_code),
    material_name: parseStr(body.material_name),
    material_source: parseStr(body.material_source),
    material_usedfor: parseStr(body.material_usedfor),
    material_type: parseStr(body.material_type),
    supplier_name: parseStr(body.supplier_name),
    material_brand: parseStr(body.material_brand),
    material_color: parseStr(body.material_color),
    material_model: parseStr(body.material_model),
    material_feature: parseStr(body.material_feature),
    currency: String(body.currency || 'THB').trim(),
    quantity_mainunit: Number(body.quantity_mainunit) || 0,
    mainunit_name: parseStr(body.mainunit_name),
    quantity_subunit: Number(body.quantity_subunit) || 0,
    subunit_name: parseStr(body.subunit_name),
    minimum_order: Number(body.minimum_order) || 0,
    minstock: Number(body.minstock) || 0,
    maxstock: Number(body.maxstock) || 0,
    is_status: status,
    material_width: parseNum(body.material_width),
    material_width_unit: parseStr(body.material_width_unit),
    material_length: parseNum(body.material_length),
    material_length_unit: parseStr(body.material_length_unit),
    material_height: parseNum(body.material_height),
    material_height_unit: parseStr(body.material_height_unit),
    material_capacity: parseNum(body.material_capacity),
    material_capacity_unit: parseStr(body.material_capacity_unit),
    material_weight: parseNum(body.material_weight),
    material_weight_unit: parseStr(body.material_weight_unit),
  };

  if (file) {
    data.material_image = file.filename;
  } else if (body.material_image === '') {
    data.material_image = '';
  } else if (body.material_image) {
    data.material_image = String(body.material_image).trim();
  } else {
    data.material_image = '';
  }

  return data;
}

// ... (function ensureRequired, getAll, getById, getOptions, checkCode เหมือนเดิม) ...
function ensureRequired({ material_code, material_name }) {
  const missing = [];
  if (!material_code) missing.push('กรุณาพิมพ์รหัส');
  if (!material_name) missing.push('กรุณาพิมพ์ชื่อ');
  if (missing.length) {
    const err = new Error(`กรอกข้อมูลไม่ครบ: ${missing.join(', ')}`);
    err.status = 400;
    throw err;
  }
}

async function getAll(_req, res, next) {
  try {
    const rows = await model.getAll();
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const material_id = Number(req.params.material_id);
    const row = await model.getById(material_id);
    if (!row) {
      const err = new Error('ไม่พบข้อมูล');
      err.status = 404;
      throw err;
    }
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
}

async function getOptions(_req, res, next) {
  try {
    const options = await model.getDropdownOptions();
    res.json({ success: true, data: options });
  } catch (err) { next(err); }
}

async function checkCode(req, res, next) {
  try {
    const code = String(req.query.code || '').trim();
    const excludeId = req.query.excludeId || null;
    if (!code) return res.json({ exists: false });
    const exists = await model.checkCodeDuplicate(code, excludeId);
    res.json({ exists: exists });
  } catch (err) { next(err); }
}


/* --- จุดที่ต้องแก้ไขคือ create และ update --- */

async function create(req, res, next) {
  try {
    const payload = parsePayload(req.body, req.file);
    ensureRequired(payload);

    // ✅ แก้ไข: เพิ่มเฉพาะคนสร้าง (created_by) ไม่ต้องใส่ updated_by
    payload.created_by = req.user.employee_id;

    const dup = await model.checkCodeDuplicate(payload.material_code, null);
    if (dup) {
      if (req.file) deleteFile(req.file.filename);
      const err = new Error('รหัส (material_code) ซ้ำในระบบ');
      err.status = 409;
      throw err;
    }

    const newId = await model.create(payload);
    const row = await model.getById(newId);
    const io = req.app.get('io');
    if (io) io.emit('material:upsert', row);

    res.status(201).json({ success: true, data: row, message: 'เพิ่มข้อมูลสำเร็จ' });
  } catch (err) {
    if (req.file) deleteFile(req.file.filename);
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const material_id = Number(req.params.material_id);
    const exist = await model.getById(material_id);
    if (!exist) {
      if (req.file) deleteFile(req.file.filename);
      const err = new Error('ไม่พบข้อมูล');
      err.status = 404;
      throw err;
    }

    const payload = parsePayload(req.body, req.file);
    ensureRequired(payload);

    // ✅ แก้ไข: ระบุคนแก้ไขล่าสุด (updated_by) เฉพาะตอน Update
    payload.updated_by = req.user.employee_id;

    // Logic ลบรูปเดิม
    if (exist.material_image) {
      if (req.file || (payload.material_image === '' && !req.file)) {
        deleteFile(exist.material_image);
      }
    }
    if (!req.file && payload.material_image !== '' && exist.material_image && !payload.material_image) {
      payload.material_image = exist.material_image;
    }

    const dup = await model.checkCodeDuplicate(payload.material_code, material_id);
    if (dup) {
      if (req.file) deleteFile(req.file.filename);
      const err = new Error('รหัส (material_code) ซ้ำในระบบ');
      err.status = 409;
      throw err;
    }

    const ok = await model.update(material_id, payload);
    if (!ok) {
      const err = new Error('อัปเดตไม่สำเร็จ');
      err.status = 500;
      throw err;
    }

    const row = await model.getById(material_id);
    const io = req.app.get('io');
    if (io) io.emit('material:upsert', row);

    res.json({ success: true, data: row, message: 'อัปเดตข้อมูลสำเร็จ' });
  } catch (err) {
    if (req.file) deleteFile(req.file.filename);
    next(err);
  }
}

// ... (function remove และ module.exports เหมือนเดิม) ...
async function remove(req, res, next) {
  try {
    const material_id = Number(req.params.material_id);
    const exist = await model.getById(material_id);
    if (!exist) {
      const err = new Error('ไม่พบข้อมูล');
      err.status = 404;
      throw err;
    }

    const ok = await model.remove(material_id);
    if (!ok) {
      const err = new Error('ลบไม่สำเร็จ');
      err.status = 500;
      throw err;
    }

    // ✅ ลบรูปไฟล์เมื่อข้อมูลถูกลบสำเร็จ
    if (exist.material_image) {
      deleteFile(exist.material_image);
    }

    const io = req.app.get('io');
    if (io) io.emit('material:delete', { material_id });

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
  getById,
  getOptions,
  checkCode,
  create,
  update,
  remove,
};