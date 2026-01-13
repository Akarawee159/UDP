'use strict';
const model = require('./workhistoryModel');

function normDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

async function create(req, res, next) {
  try {
    const employee_id = req.params.employee_id;
    const actorId = req.user?.employee_id || null;
    const body = { ...req.body };

    ['wh_start_date', 'wh_end_date'].forEach(k => body[k] = normDate(body[k]));

    // ✅ ใส่ได้ทั้งแบบทั่วไปและแบบ wh_* (Model จะหยิบเฉพาะคอลัมน์ที่มีจริง)
    body.created_at = new Date();
    body.created_by = actorId;
    body.wh_created_at = new Date();
    body.wh_created_by = actorId;

    const wh_id = await model.insert(employee_id, body);
    const row = await model.getById(wh_id);

    try { req.app.get('io')?.emit('workhistory:upsert', row); } catch {}

    res.status(201).json({ success: true, id: wh_id, data: row });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const employee_id = req.params.employee_id;
    const rows = await model.listAll(employee_id);
    res.json({ success: true, rows });
  } catch (err) { next(err); }
}

async function detail(req, res, next) {
  try {
    const wh_id = req.params.id;
    const row = await model.getById(wh_id);
    if (!row) { const e = new Error('ไม่พบข้อมูลประวัติการทำงาน'); e.status = 404; throw e; }
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const wh_id = req.params.id;
    const actorId = req.user?.employee_id || null;
    const body = { ...req.body };

    ['wh_start_date', 'wh_end_date'].forEach(k => body[k] = normDate(body[k]));
    body.updated_at = new Date();
    body.updated_by = actorId;
    body.wh_updated_at = new Date();
    body.wh_updated_by = actorId;

    const affected = await model.update(wh_id, body);
    if (!affected) { const e = new Error('ไม่พบข้อมูลที่จะแก้ไข'); e.status = 404; throw e; }

    const row = await model.getById(wh_id);
    try { req.app.get('io')?.emit('workhistory:upsert', row); } catch {}

    res.json({ success: true, data: row });
  } catch (err) { next(err); }
}

async function softDelete(req, res, next) {
  try {
    const wh_id = req.params.id;
    const actorId = req.user?.employee_id || null;

    const affected = await model.softDelete(wh_id, actorId);
    if (!affected) { const e = new Error('ไม่พบข้อมูลที่จะลบ'); e.status = 404; throw e; }

    try { req.app.get('io')?.emit('workhistory:delete', { id: wh_id }); } catch {}

    res.json({ success: true, id: wh_id });
  } catch (err) { next(err); }
}

module.exports = { create, list, detail, update, softDelete };
