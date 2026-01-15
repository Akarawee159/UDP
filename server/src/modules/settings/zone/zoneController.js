// src/modules/settings/zone/zoneController.js
'use strict';

const model = require('./zoneModel');

/** helper: trim และ validate payload */
function parsePayload(body) {
  const G_CODE = String(body.G_CODE || '').trim();
  const G_NAME = String(body.G_NAME || '').trim();
  return { G_CODE, G_NAME };
}

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

/** GET /api/settings/zone */
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

/** POST /api/settings/zone */
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
    if (io) io.emit('zone:upsert', row); // ✅ Event: zone

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
    if (io) io.emit('zone:upsert', row); // ✅ Event: zone

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
    if (io) io.emit('zone:delete', { G_ID }); // ✅ Event: zone

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