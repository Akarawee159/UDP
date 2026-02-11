'use strict';
const db = require('../../../config/database');

async function getColumns() {
  const [rows] = await db.query('SHOW COLUMNS FROM employees_relatives');
  return new Set(rows.map(r => r.Field));
}

// export ช่วย Controller ใช้งาน
async function resolveEmployeeId(empParam) {
  if (!empParam) return null;
  const onlyDigits = String(empParam).match(/^\d+$/);
  if (onlyDigits) return Number(empParam);
  const [r] = await db.query(
    'SELECT employee_id FROM employees WHERE employee_code = ? OR employee_id = ? LIMIT 1',
    [String(empParam), String(empParam)]
  );
  return r[0]?.employee_id || null;
}

async function getBaseById(employee_id) {
  const [rows] = await db.query(
    'SELECT employee_id, employee_code FROM employees WHERE employee_id = ? LIMIT 1',
    [employee_id]
  );
  return rows[0] || null;
}

// หา g_id ถัดไป (พยายามต่อพนักงานคนนั้น ๆ)
async function getNextGIdForEmployee(employee_id) {
  // หมายเหตุ: ถ้าตารางกำหนด PRIMARY KEY(g_id) “อย่างเดียว”
  // ต่อให้หา per-employee ก็เสี่ยงชนกัน ถ้ามีพนักงานหลายคนเริ่มจาก 1
  // ควรเปลี่ยนเป็น PRIMARY KEY(employee_id, g_id) หรือเพิ่ม UNIQUE(employee_id, g_id)
  const [r] = await db.query(
    'SELECT MAX(g_id) AS maxId FROM employees_relatives WHERE employee_id = ?',
    [employee_id]
  );
  const nextLocal = (r[0]?.maxId || 0) + 1;

  // กันกรณี PK ชน (ถ้า schema ยังเป็น PK(g_id) เดี่ยว ๆ)
  const [g] = await db.query('SELECT MAX(g_id) AS maxGlobal FROM employees_relatives');
  const nextGlobal = (g[0]?.maxGlobal || 0) + 1;

  // เลือกค่าที่ “ไม่น่าจะชน” ที่สุด
  return Math.max(nextLocal, nextGlobal);
}

async function insert(employee_id, payload = {}) {
  // ✅ 1. สร้างตัวแปร now
  const now = new Date();

  const columns = await getColumns();
  if (!columns.has('employee_id') || !columns.has('employee_code')) {
    const e = new Error('employees_relatives missing employee_id/employee_code');
    e.status = 500; throw e;
  }
  const base = await getBaseById(employee_id);
  if (!base) { const e = new Error('ไม่พบพนักงาน'); e.status = 404; throw e; }

  // map fields
  const fields = [];
  const params = [];

  function push(f, v) { fields.push('`' + f + '`'); params.push(v === '' ? null : v); }

  push('employee_id', employee_id);
  push('employee_code', base.employee_code);

  if (payload.g_id != null && columns.has('g_id')) push('g_id', payload.g_id);

  ['g_full_name', 'g_relation', 'g_address', 'g_phone', 'is_status'].forEach(k => {
    if (columns.has(k) && payload[k] !== undefined) push(k, payload[k]);
  });

  // ✅ 2. เปลี่ยนจุดนี้: ใช้ push แทนการเขียน SQL สด
  if (columns.has('created_at')) push('created_at', now);
  if (columns.has('created_by')) push('created_by', payload.created_by ?? null);

  const sql = `
    INSERT INTO employees_relatives
    SET ${fields.map(f => `${f} = ?`).join(', ')} 
  `;


  const [rs] = await db.query(sql, params);
  return payload.g_id || rs.insertId || null;
}

async function listAll(employeeParam) {
  const eid = await resolveEmployeeId(employeeParam);
  if (!eid) return [];
  const [rows] = await db.query(
    `SELECT * FROM employees_relatives
     WHERE employee_id = ? AND (is_status IS NULL OR is_status <> '99')
     ORDER BY g_id ASC`,
    [eid]
  );
  return rows;
}

async function getOne(employee_id, g_id) {
  const [rows] = await db.query(
    `SELECT * FROM employees_relatives WHERE employee_id = ? AND g_id = ? LIMIT 1`,
    [employee_id, g_id]
  );
  return rows[0] || null;
}

async function updateOne(employee_id, g_id, payload = {}) {
  // ✅ 1. สร้างตัวแปร now
  const now = new Date();

  const columns = await getColumns();
  const sets = [];
  const params = [];

  function setKV(f, v) { sets.push('`' + f + '` = ?'); params.push(v === '' ? null : v); }

  ['g_full_name', 'g_relation', 'g_address', 'g_phone', 'is_status'].forEach(k => {
    if (columns.has(k) && payload[k] !== undefined) setKV(k, payload[k]);
  });

  if (columns.has('updated_by')) setKV('updated_by', payload.updated_by ?? null);

  if (columns.has('updated_at')) setKV('updated_at', now);

  if (!sets.length) return 0;

  const sql = `
    UPDATE employees_relatives
    SET ${sets.join(', ')}
    WHERE employee_id = ? AND g_id = ?
  `;
  params.push(employee_id, g_id);
  const [rs] = await db.query(sql, params);
  return rs.affectedRows || 0;
}

async function softDelete(employee_id, g_id, payload = {}) {
  // ✅ 1. สร้างตัวแปร now
  const now = new Date();

  const columns = await getColumns();
  const sets = [];
  const params = [];

  if (columns.has('is_status')) sets.push("`is_status` = '99'");
  if (columns.has('deleted_by')) { sets.push('`deleted_by` = ?'); params.push(payload.deleted_by ?? null); }

  // ✅ 2. เปลี่ยนจุดนี้: ใส่ ? และ push now ลง params
  if (columns.has('deleted_at')) {
    sets.push('`deleted_at` = ?');
    params.push(now);
  }

  const sql = `
    UPDATE employees_relatives
    SET ${sets.join(', ')}
    WHERE employee_id = ? AND g_id = ?
  `;
  params.push(employee_id, g_id);
  const [rs] = await db.query(sql, params);
  return rs.affectedRows || 0;
}

module.exports = {
  resolveEmployeeId,
  getNextGIdForEmployee,
  insert,
  listAll,
  getOne,
  updateOne,
  softDelete,
};
