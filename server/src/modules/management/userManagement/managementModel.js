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

/** เคลียร์บัญชีผู้ใช้ หรือ Soft Delete สำหรับ Affiliate */
async function clearUserAccount(employee_id, deleted_by) {
  const now = new Date();
  // ป้องกันลบแอดมินตัวหลัก
  if (String(employee_id) === '1') {
    const err = new Error('ไม่อนุญาตให้ลบบัญชีผู้ดูแลระบบ');
    err.status = 403;
    throw err;
  }

  // ✅ เพิ่มเงื่อนไข: ถ้าเป็นผู้ใช้งานบริษัทในเครือ (รหัสขึ้นต้นด้วย OTHER)
  if (String(employee_id).startsWith('OTHER')) {
    const sql = `
      UPDATE employees
      SET is_status = 99,
          deleted_at = ?,
          deleted_by = ?,
          username = NULL,
          password = NULL,
          permission_role = NULL,
          password_changed_at = NULL,
          password_expires_at = NULL
      WHERE employee_id = ?
      LIMIT 1
    `;
    const [result] = await db.query(sql, [now, deleted_by, employee_id]);
    return { affectedRows: result.affectedRows };
  }

  // กรณีพนักงานปกติ (Clear Account) -> Logic เดิม
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
  const now = new Date();
  const days = Number(expiryDays);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const [result] = await db.query(
    `UPDATE employees
       SET password = ?,
           password_changed_at = ?,
           password_expires_at = ?,
           password_expiry_days = ?,
           must_change_password = 0
     WHERE employee_id = ?
     LIMIT 1`,
    [password_hash, now, expiresAt, days, employee_id]
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

/** ===== (เพิ่มใหม่) สร้าง ID สำหรับ Affiliate: OTHERddmmyy + ลำดับ(3) ===== */
function _prefixToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yy = String(d.getFullYear()).slice(-2);
  return `OTHER${dd}${mm}${yy}`;
}

async function generateAffiliateId() {
  const prefix = _prefixToday();
  const sql = `
    SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id, LENGTH(?) + 1, 3) AS UNSIGNED)), 0) AS lastSeq
    FROM employees
    WHERE employee_id LIKE CONCAT(?, '%')
      AND employee_id REGEXP CONCAT('^', ?, '[0-9]{3}$')
  `;
  const [rows] = await db.query(sql, [prefix, prefix, prefix]);
  const last = Number(rows[0]?.lastSeq || 0);
  const next = last + 1;
  const seq = String(next).padStart(3, '0').slice(-3);
  return `${prefix}${seq}`;
}

/** (เพิ่มใหม่) สร้างผู้ใช้งาน Affiliate (Insert ข้อมูลพนักงานใหม่ + User) */
async function createAffiliateUser(payload) {
  const now = new Date();
  const {
    employee_id, employee_code,
    titlename_th, firstname_th, lastname_th,
    username, password, permission_role,
    password_expiry_days,
    created_by // ✅ 1. รับค่า created_by
  } = payload;

  // คำนวณวันหมดอายุรหัสผ่าน
  const days = Number(password_expiry_days || 90);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  // ✅ 2. เพิ่ม created_by ลงใน SQL
  const sql = `
    INSERT INTO employees (
      employee_id, employee_code,
      titlename_th, firstname_th, lastname_th,
      username, password, permission_role,
      is_status, company, branch,
      password_changed_at, password_expires_at, password_expiry_days, must_change_password,
      created_by, created_at
    ) VALUES (
      ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      1, 'Affiliate', 'สำนักงานใหญ่',
      ?, ?, ?, 0,
      ?, ?
    )
  `;

  // ✅ 3. เพิ่ม created_by ลงใน Array ของ Parameters (ลำดับต้องตรงกับ ? ใน SQL)
  const [result] = await db.query(sql, [
    employee_id, employee_code,
    titlename_th, firstname_th, lastname_th,
    username, password, permission_role,
    now, expiresAt, days,
    created_by, now
  ]);

  return { affectedRows: result.affectedRows };
}

/** ดึงรายการคำนำหน้าชื่อ (ไทย) */
async function getTitlenames() {
  const sql = `
    SELECT G_NAME AS name_th 
    FROM tb_titlename 
    ORDER BY G_ID ASC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

/** (เพิ่มใหม่) สร้าง Employee Code สำหรับ Affiliate: 99 + ลำดับ(6) */
async function generateAffiliateCode() {
  // หาเลขลำดับสูงสุด ของรหัสที่ขึ้นต้นด้วย 99 และมีความยาว 8 ตัว (99 + 6 หลัก)
  const sql = `
    SELECT MAX(CAST(SUBSTRING(employee_code, 3) AS UNSIGNED)) as lastSeq
    FROM employees
    WHERE employee_code LIKE '99%' 
      AND LENGTH(employee_code) = 8
      AND employee_code REGEXP '^[0-9]+$'
  `;
  const [rows] = await db.query(sql);
  const last = Number(rows[0]?.lastSeq || 0);
  const next = last + 1;

  // สร้างเลข 6 หลัก (เช่น 1 -> 000001)
  const seq = String(next).padStart(6, '0');
  return `99${seq}`;
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
  generateAffiliateId,
  createAffiliateUser,
  getTitlenames,
  generateAffiliateCode,
};
