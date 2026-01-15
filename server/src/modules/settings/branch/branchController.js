'use strict';

const model = require('./branchModel');

/** helper: trim และ validate payload */
// ... (ฟังก์ชัน parsePayload และ ensureRequired คงเดิม) ...
function parsePayload(body) {
  const G_CODE = String(body.G_CODE || '').trim();
  const G_NAME = String(body.G_NAME || '').trim();
  const G_ADDRESS = String(body.G_ADDRESS || '').trim();
  const company_code = String(body.company_code || '').trim();

  return { G_CODE, G_NAME, G_ADDRESS, company_code };
}

function ensureRequired({ G_CODE, G_NAME, G_ADDRESS, company_code }) {
  const missing = [];
  if (!G_CODE) missing.push('กรุณาพิมพ์รหัส');
  if (!G_NAME) missing.push('กรุณาพิมพ์ชื่อ');
  if (!G_ADDRESS) missing.push('กรุณาพิมพ์ที่อยู่');
  if (!company_code) missing.push('กรุณาเลือกบริษัท');
  if (missing.length) {
    const err = new Error(`กรอกข้อมูลไม่ครบ: ${missing.join(', ')}`);
    err.status = 400;
    throw err;
  }
}

/** GET /api/branch */
// ... (ฟังก์ชัน getAll, getCompanyCodes, getById คงเดิม) ...
async function getAll(_req, res, next) {
  try {
    const rows = await model.getAll();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function getCompanyCodes(_req, res, next) {
  try {
    const codes = await model.listCompanyCodes();
    res.json({ success: true, data: codes });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const G_ID = Number(req.params.G_ID);
    const row = await model.getById(G_ID);
    if (!row) {
      const err = new Error('ไม่พบข้อมูลสาขา');
      err.status = 404;
      throw err;
    }
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}


// ✅ เพิ่มฟังก์ชันนี้เข้ามาใหม่
/** GET /api/branch/check-code?code=...&excludeId=... */
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
    const exists = await model.isBranchCodeTaken(code, excludeId);

    // 4. ส่งผลลัพธ์ { exists: true } หรือ { exists: false } กลับไป
    res.json({ exists: exists });

  } catch (err) {
    // 5. จัดการ Error (ถ้ามี)
    next(err);
  }
}


/** POST /api/branch */
// ... (ฟังก์ชัน create, update, remove คงเดิม) ...
async function create(req, res, next) {
  try {
    const payload = parsePayload(req.body);
    ensureRequired(payload);

    // company_code ต้องมีอยู่จริงใน tb_company
    const okCompany = await model.companyExists(payload.company_code);
    if (!okCompany) {
      const err = new Error('company_code ไม่ถูกต้อง (ไม่มีใน tb_company)');
      err.status = 400;
      throw err;
    }

    // กันซ้ำ G_CODE
    const dup = await model.isBranchCodeTaken(payload.G_CODE, null);
    if (dup) {
      const err = new Error('G_CODE ซ้ำในระบบ');
      err.status = 409;
      throw err;
    }

    const newId = await model.create(payload);
    const row = await model.getById(newId);

    // broadcast realtime
    const io = req.app.get('io');
    if (io) io.emit('branch:upsert', row);

    res.status(201).json({ success: true, data: row, message: 'เพิ่มสาขาสำเร็จ' });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const G_ID = Number(req.params.G_ID);
    const exist = await model.getById(G_ID);
    if (!exist) {
      const err = new Error('ไม่พบข้อมูลสาขา');
      err.status = 404;
      throw err;
    }

    const payload = parsePayload(req.body);
    ensureRequired(payload);

    // company_code ต้องอยู่ใน tb_company
    const okCompany = await model.companyExists(payload.company_code);
    if (!okCompany) {
      const err = new Error('company_code ไม่ถูกต้อง (ไม่มีใน tb_company)');
      err.status = 400;
      throw err;
    }

    // กันซ้ำ G_CODE (ยกเว้นของตัวเอง)
    const dup = await model.isBranchCodeTaken(payload.G_CODE, G_ID);
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
    if (io) io.emit('branch:upsert', row);

    res.json({ success: true, data: row, message: 'อัปเดตสาขาสำเร็จ' });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const G_ID = Number(req.params.G_ID);
    const exist = await model.getById(G_ID);
    if (!exist) {
      const err = new Error('ไม่พบข้อมูลสาขา');
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
    if (io) io.emit('branch:delete', { G_ID });

    res.json({ success: true, message: 'ลบสาขาสำเร็จ' });
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
  getCompanyCodes,
  getById,
  checkCode,
  create,
  update,
  remove,
};