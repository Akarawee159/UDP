'use strict';

const db = require('../../../config/database');

/** ดึงรายการข้อมูลทั้งหมด พร้อมชื่อแผนก */
async function getAll() {
  // ✅ 1. เพิ่ม LEFT JOIN tb_department
  const sql = `
    SELECT 
      p.G_ID, 
      p.G_CODE, 
      p.G_NAME,
      p.department_code,
      d.G_NAME AS dept_name,
      d.G_CODE AS dept_code_ref
    FROM tb_position p
    LEFT JOIN tb_department d ON p.department_code = d.G_CODE
    ORDER BY p.G_ID ASC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

/** ดึงข้อมูลตาม G_ID */
async function getById(G_ID) {
  // ✅ 2. เพิ่ม department_code
  const sql = `
    SELECT G_ID, G_CODE, G_NAME, department_code
    FROM tb_position
    WHERE G_ID = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [G_ID]);
  return rows[0] || null;
}

/** ดึงรายชื่อแผนกสำหรับ Dropdown */
async function listDepartmentCodes() {
  // ✅ 3. ฟังก์ชันใหม่สำหรับดึง Department
  const sql = `SELECT G_CODE, G_NAME FROM tb_department ORDER BY G_CODE ASC`;
  const [rows] = await db.query(sql);
  return rows;
}

/** ตรวจว่ามี G_CODE ซ้ำหรือไม่ */
async function checkCodeDuplicate(G_CODE, excludeId = null) {
  let sql = `SELECT G_ID FROM tb_position WHERE G_CODE = ?`;
  const params = [G_CODE];
  if (excludeId != null) {
    sql += ` AND G_ID <> ?`;
    params.push(excludeId);
  }
  const [rows] = await db.query(sql, params);
  return rows.length > 0;
}

/** เพิ่มข้อมูลใหม่ */
async function create({ G_CODE, G_NAME, department_code }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [lastRows] = await conn.query(
      'SELECT G_ID FROM tb_position ORDER BY G_ID DESC LIMIT 1 FOR UPDATE'
    );

    const nextId = lastRows.length ? Number(lastRows[0].G_ID) + 1 : 1;

    // ✅ 4. เพิ่ม department_code ลง Database
    const sql = `
      INSERT INTO tb_position (G_ID, G_CODE, G_NAME, department_code)
      VALUES (?, ?, ?, ?)
    `;
    await conn.query(sql, [nextId, G_CODE, G_NAME, department_code]);

    await conn.commit();
    return nextId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** แก้ไขข้อมูล */
async function update(G_ID, { G_CODE, G_NAME, department_code }) {
  // ✅ 5. อัปเดต department_code
  const sql = `
    UPDATE tb_position
    SET G_CODE = ?, G_NAME = ?, department_code = ?
    WHERE G_ID = ?
  `;
  const [result] = await db.query(sql, [
    G_CODE, G_NAME, department_code, G_ID
  ]);
  return result.affectedRows > 0;
}

/** ลบข้อมูล */
async function remove(G_ID) {
  const sql = `DELETE FROM tb_position WHERE G_ID = ?`;
  const [result] = await db.query(sql, [G_ID]);
  return result.affectedRows > 0;
}

module.exports = {
  getAll,
  getById,
  listDepartmentCodes, // Export ฟังก์ชันใหม่
  checkCodeDuplicate,
  create,
  update,
  remove,
};