'use strict';

const db = require('../../../config/database');

/** ดึงรายการข้อมูลทั้งหมด พร้อมชื่อสาขา */
async function getAll() {
  // ✅ 1. เพิ่ม LEFT JOIN tb_branch
  const sql = `
    SELECT 
      d.G_ID, 
      d.G_CODE, 
      d.G_NAME,
      d.branch_code,
      b.G_NAME AS branch_name,
      b.G_CODE AS branch_code_ref
    FROM tb_department d
    LEFT JOIN tb_branch b ON d.branch_code = b.G_CODE
    ORDER BY d.G_ID ASC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

/** ดึงข้อมูลตาม G_ID */
async function getById(G_ID) {
  // ✅ 2. เพิ่ม branch_code
  const sql = `
    SELECT G_ID, G_CODE, G_NAME, branch_code
    FROM tb_department
    WHERE G_ID = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [G_ID]);
  return rows[0] || null;
}

/** ดึงรายชื่อสาขาสำหรับ Dropdown */
async function listBranchCodes() {
  // ✅ 3. ฟังก์ชันใหม่สำหรับดึง Branch
  const sql = `SELECT G_CODE, G_NAME FROM tb_branch ORDER BY G_CODE ASC`;
  const [rows] = await db.query(sql);
  return rows;
}

async function checkCodeDuplicate(G_CODE, excludeId = null) {
  let sql = `SELECT G_ID FROM tb_department WHERE G_CODE = ?`;
  const params = [G_CODE];
  if (excludeId != null) {
    sql += ` AND G_ID <> ?`;
    params.push(excludeId);
  }
  const [rows] = await db.query(sql, params);
  return rows.length > 0;
}

/** เพิ่มข้อมูลใหม่ */
async function create({ G_CODE, G_NAME, branch_code }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [lastRows] = await conn.query(
      'SELECT G_ID FROM tb_department ORDER BY G_ID DESC LIMIT 1 FOR UPDATE'
    );
    const nextId = lastRows.length ? Number(lastRows[0].G_ID) + 1 : 1;

    // ✅ 4. เพิ่ม branch_code ลง Database
    const sql = `
      INSERT INTO tb_department (G_ID, G_CODE, G_NAME, branch_code)
      VALUES (?, ?, ?, ?)
    `;
    await conn.query(sql, [nextId, G_CODE, G_NAME, branch_code]);

    await conn.commit();
    return nextId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** แก้ไขข้อมูล และอัปเดต tb_position ด้วย */
async function update(G_ID, { G_CODE, G_NAME, branch_code }) {
  const conn = await db.getConnection(); // 1. ขอ Connection
  try {
    await conn.beginTransaction(); // 2. เริ่ม Transaction

    // 3. ดึง G_CODE เดิมเพื่อเอาไปเช็คว่าเปลี่ยนหรือไม่
    const [oldRows] = await conn.query(
      'SELECT G_CODE FROM tb_department WHERE G_ID = ? LIMIT 1',
      [G_ID]
    );
    const oldGCode = oldRows[0]?.G_CODE;

    // ✅ 4. อัปเดต tb_department (เพิ่ม branch_code)
    const sqlDept = `
      UPDATE tb_department
      SET G_CODE = ?, G_NAME = ?, branch_code = ?
      WHERE G_ID = ?
    `;
    const [result] = await conn.query(sqlDept, [
      G_CODE, G_NAME, branch_code, G_ID
    ]);

    // ✅ 5. Cascading Update ไปยัง tb_position
    if (oldGCode && oldGCode !== G_CODE) {
      const sqlPos = `
        UPDATE tb_position
        SET department_code = ?
        WHERE department_code = ?
      `;
      // เปลี่ยน department_code จาก "ค่าเก่า" เป็น "ค่าใหม่"
      await conn.query(sqlPos, [G_CODE, oldGCode]);
    }

    await conn.commit();
    return result.affectedRows > 0;

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function remove(G_ID) {
  const sql = `DELETE FROM tb_department WHERE G_ID = ?`;
  const [result] = await db.query(sql, [G_ID]);
  return result.affectedRows > 0;
}

module.exports = {
  getAll,
  getById,
  listBranchCodes, // Export ฟังก์ชันใหม่
  checkCodeDuplicate,
  create,
  update,
  remove,
};