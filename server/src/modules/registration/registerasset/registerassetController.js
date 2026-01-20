// src/modules/registration/registerasset/registerboxController.js
'use strict';

const model = require('./registerassetModel');

/** helper: trim และ validate payload */
function parsePayload(body) {
  const asset_code = String(body.asset_code || '').trim();
  const asset_detail = String(body.asset_detail || '').trim();
  return { asset_code, asset_detail };
}

function ensureRequired({ asset_code, asset_detail }) {
  const missing = [];
  if (!asset_code) missing.push('กรุณาพิมพ์รหัส');
  if (!asset_detail) missing.push('กรุณาพิมพ์ชื่อ');

  if (missing.length) {
    const err = new Error(`กรอกข้อมูลไม่ครบ: ${missing.join(', ')}`);
    err.status = 400;
    throw err;
  }
}

/** GET /api/settings/registerasset */
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
    const asset_id = Number(req.params.asset_id);
    const row = await model.getById(asset_id);
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

/** POST /api/settings/registerasset */
async function create(req, res, next) {
  try {
    const payload = parsePayload(req.body);
    ensureRequired(payload);

    const dup = await model.checkCodeDuplicate(payload.asset_code, null);
    if (dup) {
      const err = new Error('รหัสโซน (asset_code) ซ้ำในระบบ');
      err.status = 409;
      throw err;
    }

    const newId = await model.create(payload);
    const row = await model.getById(newId);

    const io = req.app.get('io');
    if (io) io.emit('registerasset:upsert', row); // ✅ Event: registerasset

    res.status(201).json({ success: true, data: row, message: 'เพิ่มข้อมูลสำเร็จ' });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const asset_id = Number(req.params.asset_id);
    const exist = await model.getById(asset_id);
    if (!exist) {
      const err = new Error('ไม่พบข้อมูล');
      err.status = 404;
      throw err;
    }

    const payload = parsePayload(req.body);
    ensureRequired(payload);

    const dup = await model.checkCodeDuplicate(payload.asset_code, asset_id);
    if (dup) {
      const err = new Error('รหัสโซน (asset_code) ซ้ำในระบบ');
      err.status = 409;
      throw err;
    }

    const ok = await model.update(asset_id, payload);
    if (!ok) {
      const err = new Error('อัปเดตไม่สำเร็จ');
      err.status = 500;
      throw err;
    }

    const row = await model.getById(asset_id);

    const io = req.app.get('io');
    if (io) io.emit('registerasset:upsert', row); // ✅ Event: registerasset

    res.json({ success: true, data: row, message: 'อัปเดตข้อมูลสำเร็จ' });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const asset_id = Number(req.params.asset_id);
    const exist = await model.getById(asset_id);
    if (!exist) {
      const err = new Error('ไม่พบข้อมูล');
      err.status = 404;
      throw err;
    }

    const ok = await model.remove(asset_id);
    if (!ok) {
      const err = new Error('ลบไม่สำเร็จ');
      err.status = 500;
      throw err;
    }

    const io = req.app.get('io');
    if (io) io.emit('registerasset:delete', { asset_id }); // ✅ Event: registerasset

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