'use strict';
const model = require('./relativesModel');

function actorId(req) {
  // สมมติ auth middleware ใส่ req.user ไว้แล้ว
  return req?.user?.employee_id || null;
}

async function create(req, res, next) {
  try {
    const employeeParam = req.params.employee_id;
    const eid = await model.resolveEmployeeId(employeeParam);
    if (!eid) { const e = new Error('ไม่พบพนักงาน'); e.status = 404; throw e; }

    // หาเลข g_id ถัดไป (ตั้งใจให้เริ่ม 1 แล้ว +1 ไปเรื่อย ๆ ต่อ "พนักงานคนนั้น")
    let g_id = await model.getNextGIdForEmployee(eid);

    // ประกอบ payload พร้อม audit
    const payload = {
      ...req.body,
      g_id,
      created_at: new Date(),           // จะ map เป็น NOW() ที่ Model
      created_by: actorId(req),
      is_status: req.body?.is_status ?? null,
    };

    const id = await model.insert(eid, payload);

    // กระจาย event (option)
    try { req.app.get('io')?.emit('relatives:upsert', { employee_id: eid, g_id }); } catch {}

    res.status(201).json({ success: true, g_id: id || g_id });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const employeeParam = req.params.employee_id;
    const g_id = Number(req.params.g_id);
    const eid = await model.resolveEmployeeId(employeeParam);
    if (!eid || !g_id) { const e = new Error('พารามิเตอร์ไม่ถูกต้อง'); e.status = 400; throw e; }

    const payload = {
      ...req.body,
      updated_at: new Date(),
      updated_by: actorId(req),
    };

    const affected = await model.updateOne(eid, g_id, payload);
    if (!affected) { const e = new Error('ไม่พบรายการที่ต้องการอัปเดต'); e.status = 404; throw e; }

    try { req.app.get('io')?.emit('relatives:upsert', { employee_id: eid, g_id }); } catch {}

    res.json({ success: true, affected });
  } catch (err) { next(err); }
}

async function softDelete(req, res, next) {
  try {
    const employeeParam = req.params.employee_id;
    const g_id = Number(req.params.g_id);
    const eid = await model.resolveEmployeeId(employeeParam);
    if (!eid || !g_id) { const e = new Error('พารามิเตอร์ไม่ถูกต้อง'); e.status = 400; throw e; }

    const payload = {
      is_status: '99',
      deleted_at: new Date(),
      deleted_by: actorId(req),
    };

    const affected = await model.softDelete(eid, g_id, payload);
    if (!affected) { const e = new Error('ไม่พบรายการที่ต้องการลบ'); e.status = 404; throw e; }

    try { req.app.get('io')?.emit('relatives:delete', { employee_id: eid, g_id }); } catch {}

    res.json({ success: true, affected });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const employee_id = req.params.employee_id;
    const rows = await model.listAll(employee_id);
    res.json({ success: true, rows });
  } catch (err) { next(err); }
}

module.exports = { create, update, softDelete, list };
