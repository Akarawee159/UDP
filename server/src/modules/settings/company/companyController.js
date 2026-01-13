'use strict';

// ✅ แก้ path model ให้ถูกต้อง
const model = require('./companyModel');

/** helper: trim และ validate payload */
function parsePayload(body) {
  return {
    company_code: String(body.company_code || '').trim(),
    business_type: String(body.business_type || '').trim(),
    branch_name: String(body.branch_name || '').trim(),
    company_name_th: String(body.company_name_th || '').trim(),
    company_name_en: String(body.company_name_en || '').trim(),
    address_th: String(body.address_th || '').trim(),
    address_en: String(body.address_en || '').trim(),
    phone: String(body.phone || '').trim(),
    tax_no: String(body.tax_no || '').trim(),
  };
}

function ensureRequired(payload) {
  const missing = [];
  if (!payload.company_code) missing.push('รหัสบริษัท');
  if (!payload.company_name_th) missing.push('ชื่อบริษัท (ไทย)');

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
    const id = Number(req.params.G_ID); // รับเป็น param ชื่อเดิมแต่ cast เป็น id
    const row = await model.getById(id);
    if (!row) {
      const err = new Error('ไม่พบข้อมูล');
      err.status = 404;
      throw err;
    }
    res.json({ success: true, data: row });
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

async function create(req, res, next) {
  try {
    const payload = parsePayload(req.body);
    ensureRequired(payload);

    const dup = await model.checkCodeDuplicate(payload.company_code, null);
    if (dup) {
      const err = new Error('รหัสบริษัท (Company Code) ซ้ำในระบบ');
      err.status = 409;
      throw err;
    }

    const newId = await model.create(payload);
    const row = await model.getById(newId);

    // ✅ แก้ชื่อ event เป็น company:upsert
    const io = req.app.get('io');
    if (io) io.emit('company:upsert', row);

    res.status(201).json({ success: true, data: row, message: 'เพิ่มข้อมูลสำเร็จ' });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.G_ID);
    const exist = await model.getById(id);
    if (!exist) {
      const err = new Error('ไม่พบข้อมูล');
      err.status = 404;
      throw err;
    }

    const payload = parsePayload(req.body);
    ensureRequired(payload);

    const dup = await model.checkCodeDuplicate(payload.company_code, id);
    if (dup) {
      const err = new Error('รหัสบริษัทซ้ำในระบบ');
      err.status = 409;
      throw err;
    }

    const ok = await model.update(id, payload);
    if (!ok) {
      const err = new Error('อัปเดตไม่สำเร็จ');
      err.status = 500;
      throw err;
    }

    const row = await model.getById(id);
    const io = req.app.get('io');
    if (io) io.emit('company:upsert', row);

    res.json({ success: true, data: row, message: 'อัปเดตข้อมูลสำเร็จ' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const id = Number(req.params.G_ID);
    const exist = await model.getById(id);
    if (!exist) {
      const err = new Error('ไม่พบข้อมูล');
      err.status = 404;
      throw err;
    }

    const ok = await model.remove(id);
    if (!ok) {
      const err = new Error('ลบไม่สำเร็จ');
      err.status = 500;
      throw err;
    }

    const io = req.app.get('io');
    if (io) io.emit('company:delete', { id }); // ส่งกลับเป็น id

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