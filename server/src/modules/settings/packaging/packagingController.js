// src/modules/settings/packaging/packagingController.js
'use strict';

const model = require('./packagingModel');

/** helper: trim และ validate payload */
function parsePayload(body) {
  // ฟิลด์พื้นฐาน
  const G_CODE = String(body.G_CODE || '').trim();
  const G_NAME = String(body.G_NAME || '').trim();

  // Helper แปลงตัวเลข (ถ้าว่างให้เป็น null)
  const parseNum = (val) => (val === '' || val === null || val === undefined) ? null : Number(val);
  // Helper แปลงสตริง (ถ้าว่างให้เป็น null)
  const parseStr = (val) => (val === '' || val === null || val === undefined) ? null : String(val).trim();

  return {
    G_CODE,
    G_NAME,
    G_WIDTH: parseNum(body.G_WIDTH),
    G_WIDTH_UNIT: parseStr(body.G_WIDTH_UNIT),
    G_LENGTH: parseNum(body.G_LENGTH),
    G_LENGTH_UNIT: parseStr(body.G_LENGTH_UNIT),
    G_HEIGHT: parseNum(body.G_HEIGHT),
    G_HEIGHT_UNIT: parseStr(body.G_HEIGHT_UNIT),
    G_CAPACITY: parseNum(body.G_CAPACITY),
    G_CAPACITY_UNIT: parseStr(body.G_CAPACITY_UNIT),
    G_WEIGHT: parseNum(body.G_WEIGHT),
    G_WEIGHT_UNIT: parseStr(body.G_WEIGHT_UNIT),
  };
}

// ... ส่วนที่เหลือ (ensureRequired, CRUD functions) เหมือนเดิม ...
// (คุณสามารถใช้โค้ดเดิมในส่วน ensureRequired, getAll, create, update, remove ได้เลย เพราะเราแก้ที่ Model และ parsePayload แล้ว)
// *หมายเหตุ: ต้อง copy ส่วนอื่นของไฟล์เดิมมาด้วยนะครับ โค้ดด้านบนแสดงเฉพาะส่วนที่มีการเปลี่ยนแปลง*

function ensureRequired({ G_CODE, G_NAME }) {
  const missing = [];
  if (!G_CODE) missing.push('กรุณาพิมพ์รหัส');
  if (!G_NAME) missing.push('กรุณาพิมพ์ชื่อ');

  if (missing.length) {
    const err = new Error(`กรอกข้อมูลไม่ครบ: ${missing.join(', ')}`);
    err.status = 400;
    throw err;
  }
}

/** GET /api/settings/packaging */
async function getAll(_req, res, next) {
  try {
    const rows = await model.getAll();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const G_ID = Number(req.params.G_ID);
    const row = await model.getById(G_ID);
    if (!row) {
      const err = new Error('ไม่พบข้อมูล');
      err.status = 404;
      throw err;
    }
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

async function checkCode(req, res, next) {
  try {
    const code = String(req.query.code || '').trim();
    const excludeId = req.query.excludeId || null;

    if (!code) {
      return res.json({ exists: false });
    }

    const exists = await model.checkCodeDuplicate(code, excludeId);
    res.json({ exists: exists });
  } catch (err) {
    next(err);
  }
}

/** POST /api/settings/packaging */
async function create(req, res, next) {
  try {
    const payload = parsePayload(req.body);
    ensureRequired(payload);

    const dup = await model.checkCodeDuplicate(payload.G_CODE, null);
    if (dup) {
      const err = new Error('รหัสโซน (G_CODE) ซ้ำในระบบ');
      err.status = 409;
      throw err;
    }

    const newId = await model.create(payload);
    const row = await model.getById(newId);

    const io = req.app.get('io');
    if (io) io.emit('packaging:upsert', row);

    res.status(201).json({ success: true, data: row, message: 'เพิ่มข้อมูลสำเร็จ' });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const G_ID = Number(req.params.G_ID);
    const exist = await model.getById(G_ID);
    if (!exist) {
      const err = new Error('ไม่พบข้อมูล');
      err.status = 404;
      throw err;
    }

    const payload = parsePayload(req.body);
    ensureRequired(payload);

    const dup = await model.checkCodeDuplicate(payload.G_CODE, G_ID);
    if (dup) {
      const err = new Error('รหัสโซน (G_CODE) ซ้ำในระบบ');
      err.status = 409;
      throw err;
    }

    const ok = await model.update(G_ID, payload);
    if (!ok) {
      const err = new Error('อัปเดตไม่สำเร็จ');
      err.status = 500;
      throw err;
    }

    const row = await model.getById(G_ID);

    const io = req.app.get('io');
    if (io) io.emit('packaging:upsert', row);

    res.json({ success: true, data: row, message: 'อัปเดตข้อมูลสำเร็จ' });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const G_ID = Number(req.params.G_ID);
    const exist = await model.getById(G_ID);
    if (!exist) {
      const err = new Error('ไม่พบข้อมูล');
      err.status = 404;
      throw err;
    }

    const ok = await model.remove(G_ID);
    if (!ok) {
      const err = new Error('ลบไม่สำเร็จ');
      err.status = 500;
      throw err;
    }

    const io = req.app.get('io');
    if (io) io.emit('packaging:delete', { G_ID });

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
  checkCode,
  create,
  update,
  remove,
};