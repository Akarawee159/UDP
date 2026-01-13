'use strict';
const db = require('../../../config/database');

async function getColumns() {
  const [rows] = await db.query('SHOW COLUMNS FROM employees_workhistory');
  return new Set(rows.map(r => r.Field));
}

// รับได้ทั้ง employee_id (ตัวเลข) หรือ employee_code (EMPxxxxx)
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

// หา wh_id ถัดไปแบบเริ่มจาก 1
async function computeNextWhId() {
  const [rows] = await db.query('SELECT COALESCE(MAX(wh_id), 0) + 1 AS next_id FROM employees_workhistory');
  return rows[0]?.next_id || 1;
}

async function insert(employee_id, payload = {}) {
  const eid = await resolveEmployeeId(employee_id);
  const columns = await getColumns();
  if (!columns.has('employee_id') || !columns.has('employee_code')) {
    const e = new Error('employees_workhistory missing employee_id/employee_code');
    e.status = 500; throw e;
  }
  const base = await getBaseById(eid);
  if (!base) { const e = new Error('ไม่พบพนักงาน'); e.status = 404; throw e; }

  // ✅ เติม wh_id อัตโนมัติถ้ายังไม่ส่งมา
  if (columns.has('wh_id') && payload.wh_id === undefined) {
    payload.wh_id = await computeNextWhId();
  }

  // รองรับทั้งคอลัมน์แบบปกติและแบบ wh_* สำหรับ metadata (จะเลือกเฉพาะคอลัมน์ที่มีจริงเท่านั้น)
  const fields = [...columns].filter(f =>
    payload[f] !== undefined || f === 'employee_id' || f === 'employee_code' || f === 'wh_id'
  );

  const values = fields.map(f => {
    if (f === 'employee_id') return eid;
    if (f === 'employee_code') return base.employee_code;
    const v = payload[f];
    return v === '' ? null : v;
  });

  const sql = `
    INSERT INTO employees_workhistory (${fields.map(f => `\`${f}\``).join(', ')})
    VALUES (${fields.map(() => '?').join(', ')})
  `;

  // กันชนกรณีแข่งกัน insert แล้วชน wh_id (duplicate) ให้ลองใหม่อัตโนมัติไม่เกิน 3 ครั้ง
  for (let i = 0; i < 3; i++) {
    try {
      const [rs] = await db.query(sql, values);
      // ตารางนี้ไม่มี AUTO_INCREMENT จึงคืน wh_id กลับไปแทน
      return payload.wh_id || rs.insertId || null;
    } catch (err) {
      // ถ้าเป็น duplicate key ที่ wh_id → คำนวณใหม่แล้วลองอีกครั้ง
      const dup = err && err.code === 'ER_DUP_ENTRY';
      if (dup && columns.has('wh_id')) {
        payload.wh_id = await computeNextWhId();
        const idx = fields.indexOf('wh_id');
        if (idx >= 0) values[idx] = payload.wh_id;
        continue;
      }
      throw err;
    }
  }
  throw new Error('ไม่สามารถสร้างรายการได้ (ชน wh_id ซ้ำหลายครั้ง)');
}

async function listAll(employeeParam) {
  const eid = await resolveEmployeeId(employeeParam);
  if (!eid) return [];
  const cols = await getColumns();

  // เลือกคอลัมน์ ORDER BY อย่างปลอดภัย
  let orderCol = 'wh_id';
  if (cols.has('wh_created_at')) orderCol = 'wh_created_at';
  else if (cols.has('wh_start_date')) orderCol = 'wh_start_date';

  const [rows] = await db.query(
    `SELECT * FROM employees_workhistory
     WHERE employee_id = ?
       AND (is_status IS NULL OR is_status <> 99)
     ORDER BY \`${orderCol}\` DESC`,
    [eid]
  );
  return rows;
}

async function getById(wh_id) {
  const [rows] = await db.query(
    'SELECT * FROM employees_workhistory WHERE wh_id = ? LIMIT 1',
    [wh_id]
  );
  return rows[0] || null;
}

async function update(wh_id, payload = {}) {
  const cols = await getColumns();

  const fields = Object.keys(payload).filter(
    f => cols.has(f) && !['wh_id', 'employee_id', 'employee_code'].includes(f)
  );
  if (fields.length === 0) return 0;

  const sql = `
    UPDATE employees_workhistory
       SET ${fields.map(f => `\`${f}\` = ?`).join(', ')}
     WHERE wh_id = ?
  `;
  const params = [...fields.map(f => (payload[f] === '' ? null : payload[f])), wh_id];
  const [rs] = await db.query(sql, params);
  return rs.affectedRows || 0;
}

async function softDelete(wh_id, actorId = null) {
  const cols = await getColumns();
  const delAt = cols.has('wh_deleted_at') ? 'wh_deleted_at' : (cols.has('deleted_at') ? 'deleted_at' : null);
  const delBy = cols.has('wh_deleted_by') ? 'wh_deleted_by' : (cols.has('deleted_by') ? 'deleted_by' : null);

  const sets = ['is_status = 99'];
  const params = [];

  if (delAt) { sets.push(`\`${delAt}\` = ?`); params.push(new Date()); }
  if (delBy) { sets.push(`\`${delBy}\` = ?`); params.push(actorId); }

  const sql = `UPDATE employees_workhistory SET ${sets.join(', ')} WHERE wh_id = ?`;
  params.push(wh_id);

  const [rs] = await db.query(sql, params);
  return rs.affectedRows || 0;
}

module.exports = { insert, listAll, getById, update, softDelete };
