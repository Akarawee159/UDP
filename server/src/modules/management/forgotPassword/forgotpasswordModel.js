// src/modules/management/forgotPassword/forgotpasswordModel.js
'use strict';
const db = require('../../../config/database');

async function getAll() {
  const sql = `
    SELECT employee_code, username, is_status
    FROM employees
    ORDER BY employee_code DESC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

// ✅ ฟังก์ชันค้นหาสำหรับ "ติดตามสถานะ" (Search by Code OR Username)
async function findRequestByKeyword(keyword) {
  const sql = `
        SELECT employee_code, username, is_status 
        FROM employees 
        WHERE (employee_code = ? OR username = ?) 
        AND is_status IN ('4', '5', '6')
    `;
  const [rows] = await db.query(sql, [keyword, keyword]);
  return rows.length > 0 ? rows[0] : null;
}

// ✅ ปรับปรุง: ตรวจสอบสถานะก่อน ถ้ามีคำขออยู่แล้ว (4,5,6) ให้คืนค่าเลย ไม่ต้อง update ทับ
async function requestResetPassword(employee_code, username) {
  const now = new Date();

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. ตรวจสอบว่ามี User นี้จริงหรือไม่
    const checkSql = `SELECT employee_code, is_status FROM employees WHERE employee_code = ? AND username = ?`;
    const [rows] = await connection.query(checkSql, [employee_code, username]);

    if (rows.length === 0) {
      await connection.rollback();
      return { success: false, message: 'รหัสพนักงานหรือชื่อผู้ใช้งานไม่ถูกต้อง' };
    }

    const currentStatus = String(rows[0].is_status);

    // ✅ Logic ใหม่: ถ้าสถานะเป็น 4, 5, 6 อยู่แล้ว ให้คืนค่ากลับไปเลย เพื่อให้ Frontend เด้งไปหน้า Timeline
    // ไม่ทำการ Update status เป็น 4 ซ้ำ (เพราะอาจจะขัดจังหวะ Admin ที่กำลังทำสถานะ 5 อยู่)
    if (['4', '5', '6'].includes(currentStatus)) {
      await connection.commit(); // ไม่ได้แก้อะไร แต่ commit transaction จบงาน
      return {
        success: true,
        existing: true, // flag บอกว่ามีอยู่แล้ว
        employee_code,
        status: currentStatus,
        message: 'มีคำขอนี้อยู่ในระบบแล้ว'
      };
    }

    // 2. ถ้าเป็นสถานะปกติ (ไม่ใช่ 4,5,6) ให้อัปเดตเป็น 4 (ส่งคำขอใหม่)
    const updateSql = `UPDATE employees SET is_status = '4', updated_at = ? WHERE employee_code = ?`;
    await connection.query(updateSql, [now, employee_code]);

    await connection.commit();
    return { success: true, employee_code, status: '4', existing: false };

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getStatusByCode(employee_code) {
  const sql = `SELECT employee_id, employee_code, is_status FROM employees WHERE employee_code = ?`;
  const [rows] = await db.query(sql, [employee_code]);
  return rows[0];
}

// ✅ 1. ดึงรายการที่สถานะเป็น 4 (รอตรวจสอบ)
async function getPendingRequests() {
  const sql = `
        SELECT employee_code, username, created_at 
        FROM employees 
        WHERE is_status = '4' 
        ORDER BY updated_at DESC
    `;
  const [rows] = await db.query(sql);
  return rows;
}

// ✅ 2. อัปเดตสถานะ (ปรับปรุงให้คืนค่า result ของ MySQL)
async function updateStatus(employee_code, status) {
  const now = new Date();

  const sql = `UPDATE employees SET is_status = ?, updated_at = ? WHERE employee_code = ?`;

  // เปลี่ยนจากการรับ [rows] เป็น [result] เพื่อเอา header ของ response
  const [result] = await db.query(sql, [status, now, employee_code]);

  // คืนค่า result ทั้งก้อน (ซึ่งจะมี affectedRows อยู่ข้างใน)
  return result;
}

// ✅ 3. ตรวจสอบสิทธิ์ (Main Menu 20, Sub Menu 201)
async function checkAdminPermission(roleName) {
  const sql = `SELECT main_menu, sub_menu FROM permission_group WHERE group_name = ?`;
  const [rows] = await db.query(sql, [roleName]);

  if (rows.length === 0) return false;

  const { main_menu, sub_menu } = rows[0];

  // Helper แปลงข้อมูล (เผื่อเป็น String หรือ JSON object)
  const parseList = (val) => {
    if (Array.isArray(val)) return val.map(String);
    if (typeof val === 'string') {
      try { return JSON.parse(val).map(String); } catch { return []; }
    }
    return [];
  };

  const mainList = parseList(main_menu);
  const subList = parseList(sub_menu);

  // เช็คเงื่อนไข: มีเมนูหลัก 20 และ เมนูรอง 201
  return mainList.includes('20') && subList.includes('201');
}

module.exports = {
  getAll,
  requestResetPassword,
  getStatusByCode,
  findRequestByKeyword,
  getPendingRequests,
  updateStatus,
  checkAdminPermission,
};