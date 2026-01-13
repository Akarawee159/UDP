'use strict';

const model = require('./positionModel');

/** helper: trim และ validate payload */
// ... (ฟังก์ชัน parsePayload และ ensureRequired คงเดิม) ...
function parsePayload(body) {
  const G_CODE = String(body.G_CODE || '').trim();
  const G_NAME = String(body.G_NAME || '').trim();
  const department_code = String(body.department_code || '').trim();
  return { G_CODE, G_NAME, department_code };
}

function ensureRequired({ G_CODE, G_NAME, department_code }) {
  const missing = [];
  if (!G_CODE) missing.push('กรุณาพิมพ์รหัส');
  if (!G_NAME) missing.push('กรุณาพิมพ์ชื่อ');
  if (!department_code) missing.push('กรุณาเลือกแผนก');
  if (missing.length) {
    const err = new Error(`กรอกข้อมูลไม่ครบ: ${missing.join(', ')}`);
    err.status = 400;
    throw err;
  }
}

/** GET /api/position */
// ... (ฟังก์ชัน getAll, getCompanyCodes, getById คงเดิม) ...
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


// ✅ เพิ่มฟังก์ชันนี้เข้ามาใหม่
/** GET /api/position/check-code?code=...&excludeId=... */
async function checkCode(req, res, next) {
  try {
    // 1. ดึงค่าจาก query string
    const code = String(req.query.code || '').trim();
    const excludeId = req.query.excludeId || null; // (จะมีค่าตอน 'แก้ไข')

    // 2. ถ้าไม่มี code ส่งมา ก็ไม่ถือว่าซ้ำ
    if (!code) {
      return res.json({ exists: false });
    }

    // 3. เรียกใช้ฟังก์ชันจาก Model ที่มีอยู่แล้ว
    const exists = await model.checkCodeDuplicate(code, excludeId);

    // 4. ส่งผลลัพธ์ { exists: true } หรือ { exists: false } กลับไป
    res.json({ exists: exists });

  } catch (err) {
    // 5. จัดการ Error (ถ้ามี)
    next(err);
  }
}

async function getDepartmentCodes(_req, res, next) {
  try {
    const rows = await model.listDepartmentCodes();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

/** POST /api/position */
// ... (ฟังก์ชัน create, update, remove คงเดิม) ...
async function create(req, res, next) {
  try {
    const payload = parsePayload(req.body);
    ensureRequired(payload);

    // กันซ้ำ G_CODE
    const dup = await model.checkCodeDuplicate(payload.G_CODE, null);
    if (dup) {
      const err = new Error('G_CODE ซ้ำในระบบ');
      err.status = 409;
      throw err;
    }

    const newId = await model.create(payload);
    const row = await model.getById(newId);

    // broadcast realtime
    const io = req.app.get('io');
    if (io) io.emit('position:upsert', row);

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
      const err = new Error('ไม่พบข้อมูลข');
      err.status = 404;
      throw err;
    }

    const payload = parsePayload(req.body);
    ensureRequired(payload);

    // กันซ้ำ G_CODE (ยกเว้นของตัวเอง)
    const dup = await model.checkCodeDuplicate(payload.G_CODE, G_ID);
    if (dup) {
      const err = new Error('G_CODE ซ้ำในระบบ');
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

    // broadcast realtime
    const io = req.app.get('io');
    if (io) io.emit('position:upsert', row);

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

    // broadcast realtime
    const io = req.app.get('io');
    if (io) io.emit('position:delete', { G_ID });

    res.json({ success: true, message: 'ลบข้อมูลสำเร็จ' });
  } catch (err) {
    // เผื่อกรณี FK constraint ผูกกับตารางอื่น
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      err.status = 409;
      err.message = 'ไม่สามารถลบได้ เนื่องจากมีการอ้างอิงอยู่';
    }
    next(err);
  }
}


// ✅ แก้ไข module.exports ให้รวม checkCode ด้วย
module.exports = {
  getAll,
  getById,
  checkCode,
  getDepartmentCodes,
  create,
  update,
  remove,
};