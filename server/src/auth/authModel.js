'use strict';

const db = require('../config/database');

/** หา user ตาม username */
const findUserByUsername = async (username) => {
  const [rows] = await db.query('SELECT * FROM employees WHERE username = ?', [username]);
  return rows;
};

/** เก็บ refresh token */
const saveRefreshToken = async (employeeId, token) => {
  await db.query('INSERT INTO refresh_tokens (employee_id, token) VALUES (?, ?)', [employeeId, token]);
};

/** ลบ refresh token (เฉพาะตัว) */
const deleteRefreshToken = async (token) => {
  await db.query('DELETE FROM refresh_tokens WHERE token = ?', [token]);
};

/** ตรวจว่า refresh token ยังอยู่ในระบบหรือไม่ */
const isRefreshTokenValid = async (token) => {
  const [rows] = await db.query('SELECT * FROM refresh_tokens WHERE token = ?', [token]);
  return rows;
};

/** ลบ refresh token ทั้งหมดของ employee_id (เตะออกทุกเครื่อง) */
const deleteAllRefreshTokensByEmployeeId = async (employeeId) => {
  await db.query('DELETE FROM refresh_tokens WHERE employee_id = ?', [employeeId]);
};

/** อัปเดตสถานะพนักงาน */
const updateEmployeeStatusById = async (employeeId, status) => {
  await db.query('UPDATE employees SET is_status = ? WHERE employee_id = ?', [status, employeeId]);
};

/** ---------- Token Version helpers ---------- */
const getTokenVersionByEmployeeId = async (employeeId) => {
  const [rows] = await db.query('SELECT token_version FROM employees WHERE employee_id = ? LIMIT 1', [employeeId]);
  return rows.length ? Number(rows[0].token_version || 0) : null;
};

const bumpTokenVersion = async (employeeId) => {
  await db.query('UPDATE employees SET token_version = token_version + 1 WHERE employee_id = ?', [employeeId]);
};

/** สร้าง employee + detail (กันไฟล์อื่นเรียก) */
const createFullEmployee = async (employeeData, detailData) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // ดึงค่าวันหมดอายุจาก Policy
    const policyDays = await getGlobalPasswordPolicy();

    // ✅ แก้ไข: คำนวณวันหมดอายุใน JS เพื่อแก้ปัญหา Timezone
    const expiresAt = new Date(Date.now() + policyDays * 24 * 60 * 60 * 1000);

    await conn.query(
      `INSERT INTO employees (
    employee_id, titlename_th, firstname_th, lastname_th, nickname_th,
    titlename_en, firstname_en, lastname_en, nickname_en,
    company, branch, department, position,
    signature, profileImg, username, password,
    password_changed_at, password_expires_at, password_expiry_days, must_change_password,
    permission_role, role, is_status, token_version, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, 0, ?, ?, ?, 0, NOW())`,
      [
        employeeData.employee_id, employeeData.titlename_th, employeeData.firstname_th, employeeData.lastname_th, employeeData.nickname_th,
        employeeData.titlename_en, employeeData.firstname_en, employeeData.lastname_en, employeeData.nickname_en,
        employeeData.company, employeeData.branch, employeeData.department, employeeData.position,
        employeeData.signature, employeeData.profileImg, employeeData.username, employeeData.password,
        expiresAt,
        policyDays,
        employeeData.permission_role, employeeData.role, employeeData.is_status
      ]
    );

    const employeeCode = employeeData.employee_id;

    await conn.query(
      `INSERT INTO employees_detail (
        employee_id, salary, daily_pay, overtime_pay, sign_date, resign_date,
        birthdate, age, nationality, id_card, passport, address,
        phone, email, education, employment, gender, remark, is_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employeeCode, detailData.salary, detailData.daily_pay, detailData.overtime_pay, detailData.sign_date, detailData.resign_date,
        detailData.birthdate, detailData.age, detailData.nationality, detailData.id_card, detailData.passport, detailData.address,
        detailData.phone, detailData.email, detailData.education, detailData.employment, detailData.gender,
        detailData.remark, detailData.is_status
      ]
    );

    await conn.commit();
    return { employeeId: employeeCode };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const getPasswordMetaByEmployeeId = async (employeeId) => {
  const [rows] = await db.query(
    `SELECT password_expires_at, password_expiry_days, must_change_password
       FROM employees WHERE employee_id = ? LIMIT 1`,
    [employeeId]
  );
  return rows?.[0] || null;
};


const updatePasswordAndExpiry = async (employeeId, hashedPassword, expiryDays, { clearMustChange = true } = {}) => {
  const days = Number(expiryDays);

  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await db.query(
    `UPDATE employees
        SET password = ?,
            password_changed_at = NOW(),
            password_expires_at = ?,
            password_expiry_days = ?,
            must_change_password = ?
      WHERE employee_id = ?`,
    [hashedPassword, expiresAt, days, clearMustChange ? 0 : 1, employeeId]
  );
};

// ดึงค่า Config วันหมดอายุจากตาราง tb_password_expired
const getGlobalPasswordPolicy = async () => {
  try {
    const [rows] = await db.query('SELECT G_DATE FROM tb_password_expired WHERE G_ID = 1 LIMIT 1');
    const days = rows.length > 0 ? Number(rows[0].G_DATE) : 90;
    return days > 0 ? days : 90;
  } catch (error) {
    console.error('Error fetching global password policy:', error);
    return 90;
  }
};

module.exports = {
  findUserByUsername,
  saveRefreshToken,
  deleteRefreshToken,
  isRefreshTokenValid,
  deleteAllRefreshTokensByEmployeeId,
  updateEmployeeStatusById,
  getTokenVersionByEmployeeId,
  bumpTokenVersion,
  createFullEmployee,
  getPasswordMetaByEmployeeId,
  updatePasswordAndExpiry,
  getGlobalPasswordPolicy,
};