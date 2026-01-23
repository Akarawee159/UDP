// src/modules/settings/material/materialController.js
'use strict';

const model = require('./materialModel');
const fs = require('fs');
const path = require('path');

// กำหนด Path สำหรับรูปหลักและ Drawing
const mainDir = path.join(__dirname, '../../../img/material');
const drawingDir = path.join(__dirname, '../../../img/material/drawing');

/** Helper: ลบไฟล์ออกจาก Server 
 * @param {string} filename - ชื่อไฟล์
 * @param {boolean} isDrawing - ถ้าเป็น true จะลบจากโฟลเดอร์ drawing
 */
function deleteFile(filename, isDrawing = false) {
  if (!filename) return;
  const dir = isDrawing ? drawingDir : mainDir;
  const filePath = path.join(dir, filename);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (!err) {
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error(`Failed to delete file: ${filename}`, unlinkErr);
        // else console.log(`Deleted file: ${filename}`);
      });
    }
  });
}

/** Helper: trim และ validate payload 
 * รองรับทั้ง req.body และ req.files (จาก upload.fields)
 */
function parsePayload(body, files) {
  let status = 2;
  if (body.is_status === 'true' || body.is_status === true || body.is_status === '1' || body.is_status === 1) {
    status = 1;
  }

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
    material_remark: parseStr(body.material_remark),
    material_detail: parseStr(body.material_detail),
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

    // Dimension Fields
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

  // --- จัดการ Main Image (key: 'image') ---
  if (files && files['image'] && files['image'][0]) {
    data.material_image = files['image'][0].filename; // อัปโหลดใหม่
  } else if (body.material_image === '') {
    data.material_image = ''; // สั่งลบ
  } else {
    data.material_image = body.material_image || ''; // ค่าเดิม (ถ้ามี)
  }

  // --- จัดการ Drawing Images (key: 'drawing_001'...'006') ---
  for (let i = 1; i <= 6; i++) {
    const key = `drawing_00${i}`;
    if (files && files[key] && files[key][0]) {
      data[key] = files[key][0].filename; // อัปโหลดใหม่
    } else if (body[key] === '') {
      data[key] = ''; // สั่งลบ
    } else {
      data[key] = body[key] || ''; // ค่าเดิม (ถ้ามี)
    }
  }

  return data;
}

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

// ... (Functions: getAll, getById, getOptions, checkCode keep unchanged) ...
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

/* --- Create --- */
async function create(req, res, next) {
  try {
    // ใช้ req.files แทน req.file เพราะรองรับ upload.fields
    const payload = parsePayload(req.body, req.files);
    ensureRequired(payload);

    payload.created_by = req.user.employee_id;

    const dup = await model.checkCodeDuplicate(payload.material_code, null);
    if (dup) {
      throw new Error('รหัส (material_code) ซ้ำในระบบ'); // ไป catch เพื่อลบไฟล์
    }

    const newId = await model.create(payload);
    const row = await model.getById(newId);

    const io = req.app.get('io');
    if (io) io.emit('material:upsert', row);

    res.status(201).json({ success: true, data: row, message: 'เพิ่มข้อมูลสำเร็จ' });
  } catch (err) {
    // Cleanup files if error
    if (req.files) {
      Object.values(req.files).flat().forEach(f => {
        const isDrawing = f.fieldname.startsWith('drawing_');
        deleteFile(f.filename, isDrawing);
      });
    }
    if (err.message === 'รหัส (material_code) ซ้ำในระบบ') err.status = 409;
    next(err);
  }
}

/* --- Update --- */
async function update(req, res, next) {
  try {
    const material_id = Number(req.params.material_id);
    const exist = await model.getById(material_id);
    if (!exist) {
      const err = new Error('ไม่พบข้อมูล');
      err.status = 404;
      throw err;
    }

    const payload = parsePayload(req.body, req.files);
    ensureRequired(payload);
    payload.updated_by = req.user.employee_id;

    // --- 1. จัดการลบไฟล์เดิมออกจาก Server ---

    // 1.1 Main Image
    if (exist.material_image && exist.material_image !== payload.material_image) {
      // ถ้าชื่อไฟล์เปลี่ยน หรือ ถูกเซ็ตเป็นค่าว่าง -> ลบไฟล์เก่า
      deleteFile(exist.material_image, false);
    }

    // 1.2 Drawing Images (1-6)
    for (let i = 1; i <= 6; i++) {
      const field = `drawing_00${i}`;
      const oldImg = exist[field];
      const newImg = payload[field];

      if (oldImg && oldImg !== newImg) {
        deleteFile(oldImg, true); // true = folder drawing
      }
    }

    // Check Code Duplicate
    if (payload.material_code !== exist.material_code) {
      const dup = await model.checkCodeDuplicate(payload.material_code, material_id);
      if (dup) {
        throw new Error('รหัส (material_code) ซ้ำในระบบ');
      }
    }

    const ok = await model.update(material_id, payload);
    if (!ok) {
      const err = new Error('อัปเดตไม่สำเร็จ');
      err.status = 500;
      throw err;
    }

    // --- 2. Sync ไปยัง tb_asset_lists ---

    // 2.1 Sync Main Image
    if (exist.material_image !== payload.material_image) {
      await model.updateAssetImage(
        exist.material_code,
        exist.material_image,
        payload.material_image
      );
    }

    // 2.2 Sync Drawing Images
    for (let i = 1; i <= 6; i++) {
      const field = `drawing_00${i}`;
      const targetCol = `asset_dmg_00${i}`;

      if (exist[field] !== payload[field]) {
        // อัปเดต asset drawing ทีละคอลัมน์
        await model.updateAssetDrawing(
          exist.material_code,
          targetCol,
          exist[field],   // รูปเก่า
          payload[field]  // รูปใหม่ (หรือค่าว่าง)
        );
      }
    }

    const row = await model.getById(material_id);
    const io = req.app.get('io');
    if (io) io.emit('material:upsert', row);

    res.json({ success: true, data: row, message: 'อัปเดตข้อมูลสำเร็จ' });
  } catch (err) {
    // Cleanup new files if error
    if (req.files) {
      Object.values(req.files).flat().forEach(f => {
        const isDrawing = f.fieldname.startsWith('drawing_');
        deleteFile(f.filename, isDrawing);
      });
    }
    if (err.message === 'รหัส (material_code) ซ้ำในระบบ') err.status = 409;
    next(err);
  }
}

/* --- Remove --- */
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

    // --- Cleanup Files & Sync Asset Lists ---

    // 1. Remove Main Image
    if (exist.material_image) {
      deleteFile(exist.material_image, false);
      // Sync ให้ Asset เป็นค่าว่าง
      await model.updateAssetImage(exist.material_code, exist.material_image, '');
    }

    // 2. Remove Drawing Images
    for (let i = 1; i <= 6; i++) {
      const field = `drawing_00${i}`;
      const img = exist[field];
      if (img) {
        deleteFile(img, true); // ลบไฟล์ Drawing
        // Sync ให้ Asset column นี้เป็นค่าว่าง
        await model.updateAssetDrawing(exist.material_code, `asset_dmg_00${i}`, img, '');
      }
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