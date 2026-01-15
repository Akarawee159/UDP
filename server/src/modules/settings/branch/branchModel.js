'use strict';

const db = require('../../../config/database');

/** ดึงรายการสาขาทั้งหมด */
async function getAll() {
  const sql = `
    SELECT 
      b.G_ID, 
      b.G_CODE, 
      b.G_NAME, 
      b.G_ADDRESS,
      b.company_code,
      c.company_name_th
    FROM tb_branch b
    LEFT JOIN tb_company c ON b.company_code = c.company_code
    ORDER BY b.G_ID ASC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

/** ดึงสาขาตาม G_ID */
async function getById(G_ID) {
  // ✅ แก้ไข: เพิ่ม LEFT JOIN และ Alias ชื่อคอลัมน์ให้เหมือน getAll
  const sql = `
    SELECT 
      b.G_ID, 
      b.G_CODE, 
      b.G_NAME, 
      b.G_ADDRESS, 
      b.company_code,
      c.company_name_th
    FROM tb_branch b
    LEFT JOIN tb_company c ON b.company_code = c.company_code
    WHERE b.G_ID = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [G_ID]);
  return rows[0] || null;
}

/** ตรวจว่ามี company_code นี้ใน tb_company หรือไม่ */
async function companyExists(company_code) {
  const sql = `
    SELECT 1
    FROM tb_company
    WHERE company_code = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [company_code]);
  return rows.length > 0;
}

/** ตรวจว่ามี G_CODE ซ้ำหรือไม่ (ออปชัน: ยกเว้น G_ID ปัจจุบันตอนแก้ไข) */
async function isBranchCodeTaken(G_CODE, excludeId = null) {
  let sql = `SELECT G_ID FROM tb_branch WHERE G_CODE = ?`;
  const params = [G_CODE];
  if (excludeId != null) {
    sql += ` AND G_ID <> ?`;
    params.push(excludeId);
  }
  const [rows] = await db.query(sql, params);
  return rows.length > 0;
}

/** เพิ่มสาขาใหม่ (กำหนด G_ID เอง เริ่มที่ 1 และบวกจากค่าล่าสุดแบบกันชนกัน) */
async function create({ G_CODE, G_NAME, G_ADDRESS, company_code }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // ล็อกแถวล่าสุดเพื่อกัน race condition ระหว่างคำขอพร้อมกัน
    const [lastRows] = await conn.query(
      'SELECT G_ID FROM tb_branch ORDER BY G_ID DESC LIMIT 1 FOR UPDATE'
    );

    const nextId = lastRows.length ? Number(lastRows[0].G_ID) + 1 : 1;

    const sql = `
      INSERT INTO tb_branch (G_ID, G_CODE, G_NAME, G_ADDRESS, company_code)
      VALUES (?, ?, ?, ?, ?)
    `;
    await conn.query(sql, [nextId, G_CODE, G_NAME, G_ADDRESS, company_code]);

    await conn.commit();
    return nextId; // คืนค่าที่เราออกเอง แทนการพึ่งพา insertId
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}


/** แก้ไขสาขา และอัปเดต tb_department ด้วย */
async function update(G_ID, { G_CODE, G_NAME, G_ADDRESS, company_code }) {
  const conn = await db.getConnection(); // 1. ขอ Connection
  try {
    await conn.beginTransaction(); // 2. เริ่ม Transaction

    // 3. ดึง G_CODE เดิมออกมาก่อน เพื่อเอาไปหาใน tb_department ว่าต้องแก้ตัวไหน
    const [oldRows] = await conn.query(
      'SELECT G_CODE FROM tb_branch WHERE G_ID = ? LIMIT 1',
      [G_ID]
    );
    const oldGCode = oldRows[0]?.G_CODE;

    // 4. อัปเดตตารางแม่ (tb_branch)
    const sqlBranch = `
      UPDATE tb_branch
      SET G_CODE = ?, G_NAME = ?, G_ADDRESS = ?, company_code = ?
      WHERE G_ID = ?
    `;
    const [result] = await conn.query(sqlBranch, [
      G_CODE, G_NAME, G_ADDRESS, company_code, G_ID
    ]);

    // 5. ถ้ามีการเปลี่ยน G_CODE และมีค่าเดิมอยู่ -> ไปตามแก้ใน tb_department
    if (oldGCode && oldGCode !== G_CODE) {
      const sqlDept = `
        UPDATE tb_department
        SET branch_code = ?
        WHERE branch_code = ?
      `;
      // เปลี่ยน branch_code จาก "ค่าเก่า" เป็น "ค่าใหม่"
      await conn.query(sqlDept, [G_CODE, oldGCode]);
    }

    await conn.commit(); // 6. บันทึกสำเร็จ
    return result.affectedRows > 0;

  } catch (err) {
    await conn.rollback(); // 7. ย้อนกลับข้อมูลถ้า error
    throw err;
  } finally {
    conn.release(); // 8. คืน Connection
  }
}

/** ลบสาขา */
async function remove(G_ID) {
  const sql = `DELETE FROM tb_branch WHERE G_ID = ?`;
  const [result] = await db.query(sql, [G_ID]);
  return result.affectedRows > 0;
}

/** ดึงรายการ company_code และชื่อบริษัท (ไว้ไปผูก dropdown ฝั่ง FE) */
async function listCompanyCodes() {
  // ✅ 1. เพิ่ม company_name_th ใน SELECT
  const sql = `
    SELECT company_code, company_name_th 
    FROM tb_company 
    ORDER BY company_code ASC
  `;
  const [rows] = await db.query(sql);

  // ✅ 2. ส่งคืนทั้ง row (ไม่ต้อง map แค่ code แล้ว)
  return rows;
}

module.exports = {
  getAll,
  getById,
  companyExists,
  isBranchCodeTaken,
  create,
  update,
  remove,
  listCompanyCodes,
};
