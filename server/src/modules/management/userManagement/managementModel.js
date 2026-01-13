'use strict';

const db = require('../../../config/database');

/**
 * ดึงรายการพนักงานที่มี username ไม่ว่าง
 */
async function getAll() {
  const sql = `
    SELECT
      employee_id,
      titlename_th, firstname_th, lastname_th,
      company, branch,
      username,
      permission_role,
      profileImg,
      is_status
    FROM employees
    WHERE username IS NOT NULL AND TRIM(username) <> ''
    ORDER BY employee_id ASC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

/**
 * ดึงรายการกลุ่มสิทธิทั้งหมด (ใช้เติม dropdown)
 * ใช้ field: permission_group.group_name
 */
async function getPermissionGroups() {
  const sql = `
    SELECT
      group_name
    FROM permission_group
    WHERE is_status = 1
    ORDER BY group_name ASC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

/**
 * อัปเดตสถานะการใช้งาน (1 = อนุญาตใช้งาน, 3 = ห้ามใช้งาน)
 */
async function updateStatus(employee_id, nextStatus) {
  if (![1, 3].includes(Number(nextStatus))) {
    const err = new Error('Invalid status (must be 1 or 3)');
    err.status = 400;
    throw err;
  }

  const sql = `
    UPDATE employees
    SET is_status = ?
    WHERE employee_id = ?
    LIMIT 1
  `;
  const [result] = await db.query(sql, [nextStatus, employee_id]);
  return { affectedRows: result.affectedRows };
}

/**
 * อัปเดตกลุ่มสิทธิของพนักงาน → บันทึกลง employees.permission_role
 * ตรวจสอบก่อนว่า group_name มีอยู่จริงในตาราง permission_group
 */
async function updatePermissionRole(employee_id, group_name) {
  const name = String(group_name || '').trim();
  if (!name) {
    const err = new Error('Invalid group_name');
    err.status = 400;
    throw err;
  }

  // ต้องเป็นกลุ่มที่ "มีอยู่จริง" และ "เปิดใช้งาน"
  const [chk] = await db.query(
    `SELECT is_status FROM permission_group WHERE group_name = ? LIMIT 1`,
    [name]
  );
  if (!chk || chk.length === 0) {
    const err = new Error('Group not found');
    err.status = 400;
    throw err;
  }
  if (Number(chk[0].is_status) !== 1) {
    const err = new Error('Group is disabled');
    err.status = 400;
    throw err;
  }

  const sql = `
    UPDATE employees
    SET permission_role = ?
    WHERE employee_id = ?
    LIMIT 1
  `;
  const [result] = await db.query(sql, [name, employee_id]);
  return { affectedRows: result.affectedRows };
}

/** ✅ อัปเดตรหัสผ่าน (รับค่าเป็น hash แล้ว) */
async function updatePassword(employee_id, password_hash) {
  const [result] = await db.query(
    `UPDATE employees SET password = ? WHERE employee_id = ? LIMIT 1`,
    [password_hash, employee_id]
  );
  return { affectedRows: result.affectedRows };
}

/* ---------------------- เพิ่มใหม่สำหรับ ModalCreate ---------------------- */

/** รายชื่อสาขา (ไม่ว่าง) */
async function getBranches() {
  const [rows] = await db.query(
    `SELECT DISTINCT branch
     FROM employees
     WHERE branch IS NOT NULL AND TRIM(branch) <> ''
     ORDER BY branch ASC`
  );
  return rows.map(r => r.branch);
}

/** รายชื่อพนักงานตามสาขา ในหน้า ModalCreate รายชื่อ “พนักงาน” ที่ให้เลือกจะถูกดึงมาเฉพาะ พนักงานที่ยังไม่มีบัญชีผู้ใช้ (username ว่าง) เท่านั้น */
async function getEmployeesByBranch(branch, { filter = 'with' } = {}) {
  const params = [branch];
  let where = `branch = ?`;
  if (filter === 'with') where += ` AND username IS NOT NULL AND TRIM(username) <> ''`;
  else if (filter === 'without') {
    where += ` AND (username IS NULL OR TRIM(username) = '')`
      + ` AND LOWER(COALESCE(permission_status, '')) = 'activate'`;
  }
  // 'all' ไม่กรอง username

  const [rows] = await db.query(
    `SELECT employee_id, titlename_th, firstname_th, lastname_th,
             company, branch, username, permission_role
      FROM employees
      WHERE ${where}
      ORDER BY firstname_th ASC, lastname_th ASC`,
    params
  );
  return rows;
}

/** ตรวจสอบ username ซ้ำ */
async function isUsernameTaken(username, excludeId) {
  const u = String(username || '').trim();
  if (!u) return false;

  let sql = `SELECT employee_id FROM employees WHERE username = ?`;
  const params = [u];

  if (excludeId) {
    sql += ` AND employee_id <> ?`;
    params.push(excludeId);
  }

  sql += ` LIMIT 1`;
  const [rows] = await db.query(sql, params);
  return rows.length > 0;
}

/** อัปเดต username (เช็ค unique) */
async function updateUsername(employee_id, username) {
  const u = String(username || '').trim();
  if (!u) {
    const err = new Error('Invalid username');
    err.status = 400;
    throw err;
  }

  const taken = await isUsernameTaken(u, employee_id);
  if (taken) {
    const err = new Error('Username is already taken');
    err.status = 409;
    throw err;
  }

  const [result] = await db.query(
    `UPDATE employees SET username = ? WHERE employee_id = ? LIMIT 1`,
    [u, employee_id]
  );
  return { affectedRows: result.affectedRows };
}

/** เคลียร์บัญชีผู้ใช้: username/password/permission_role = NULL */
async function clearUserAccount(employee_id) {
  // ป้องกันลบแอดมินตัวหลัก (เช่น id=1) — ปรับตามนโยบายคุณได้
  if (String(employee_id) === '1') {
    const err = new Error('ไม่อนุญาตให้ลบบัญชีผู้ดูแลระบบ');
    err.status = 403;
    throw err;
  }

  const [result] = await db.query(
    `UPDATE employees
       SET username = NULL,
           password = NULL,
           permission_role = NULL,
           is_status = NULL,
           password_changed_at = NULL,
           password_expires_at = NULL
     WHERE employee_id = ?
     LIMIT 1`,
    [employee_id]
  );
  return { affectedRows: result.affectedRows };
}

/** ดึงข้อมูลผู้ใช้ตาม id (สำหรับหน้า Setting และตรวจสอบก่อน Reset) */
async function getEmployeeById(employee_id) {
  // ✅ เพิ่ม employee_code และ is_status ในการ select
  const [rows] = await db.query(
    `SELECT employee_id, employee_code, titlename_th, firstname_th, lastname_th,
            company, branch, username, permission_role, profileImg, signature, is_status
     FROM employees
     WHERE employee_id = ?
     LIMIT 1`,
    [employee_id]
  );
  return rows[0] || null;
}

/** ✅ (เพิ่มใหม่) อัปเดตสถานะเป็น 6 (รีเซ็ทสำเร็จแล้ว) */
async function completeResetStatus(employee_id) {
  const sql = `
    UPDATE employees
    SET is_status = 6
    WHERE employee_id = ?
    LIMIT 1
  `;
  const [result] = await db.query(sql, [employee_id]);
  return { affectedRows: result.affectedRows };
}

/** อัปเดตรหัสผ่านด้วย hash ที่ส่งมา (ใช้กับ /management/me/password) */
async function updateMyPassword(employee_id, password_hash) {
  const [result] = await db.query(
    `UPDATE employees SET password = ? WHERE employee_id = ? LIMIT 1`,
    [password_hash, employee_id]
  );
  return { affectedRows: result.affectedRows };
}

/** อัปเดตรูปโปรไฟล์ */
async function updateProfileImage(employee_id, filename) {
  const [result] = await db.query(
    `UPDATE employees SET profileImg = ? WHERE employee_id = ? LIMIT 1`,
    [filename, employee_id]
  );
  return { affectedRows: result.affectedRows };
}

/** อัปเดตรูปลายเซ็น */
async function updateSignatureImage(employee_id, filename) {
  const [result] = await db.query(
    `UPDATE employees SET signature = ? WHERE employee_id = ? LIMIT 1`,
    [filename, employee_id]
  );
  return { affectedRows: result.affectedRows };
}

/** ✅ อัปเดตรหัส + วันหมดอายุ + เวลาเปลี่ยน + ล้าง must_change_password */
async function updatePasswordWithExpiry(employee_id, password_hash, expiryDays) {
  const days = Number(expiryDays);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const [result] = await db.query(
    `UPDATE employees
       SET password = ?,
           password_changed_at = NOW(),
           password_expires_at = ?,
           password_expiry_days = ?,
           must_change_password = 0
     WHERE employee_id = ?
     LIMIT 1`,
    [password_hash, expiresAt, days, employee_id]
  );
  return { affectedRows: result.affectedRows };
}

/** * ✅ (เพิ่มใหม่) อัปเดตสถานะเป็น 5 (รับเรื่องแล้ว/กำลังดำเนินการ) 
 * เฉพาะกรณีที่สถานะเดิมเป็น 4 (แจ้งลืมรหัสผ่าน) หรือจะบังคับเปลี่ยนเลยก็ได้
 */
async function acknowledgeResetStatus(employee_id) {
  const sql = `
    UPDATE employees
    SET is_status = 5
    WHERE employee_id = ?
    LIMIT 1
  `;
  const [result] = await db.query(sql, [employee_id]);
  return { affectedRows: result.affectedRows };
}

module.exports = {
  getAll,
  getPermissionGroups,
  updateStatus,
  updatePermissionRole,
  updatePassword,
  getBranches,
  getEmployeesByBranch,
  isUsernameTaken,
  updateUsername,
  clearUserAccount,
  getEmployeeById,
  completeResetStatus,
  updateMyPassword,
  updateProfileImage,
  updateSignatureImage,
  updatePasswordWithExpiry,
  acknowledgeResetStatus,
};
