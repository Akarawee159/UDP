'use strict';

const db = require('../../../config/database');

/** ดึงรายการข้อมูลทั้งหมด */
async function getAll() {
  const sql = `
    SELECT 
      id, company_code, business_type, branch_name,
      company_name_th, company_name_en,
      address_th, address_en, phone, tax_no
    FROM tb_company
    ORDER BY id ASC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

/** ดึงข้อมูลตาม ID */
async function getById(id) {
  const sql = `
    SELECT *
    FROM tb_company
    WHERE id = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [id]);
  return rows[0] || null;
}

/** ตรวจว่ามี company_code ซ้ำหรือไม่ */
async function checkCodeDuplicate(company_code, excludeId = null) {
  let sql = `SELECT id FROM tb_company WHERE company_code = ?`;
  const params = [company_code];
  if (excludeId != null) {
    sql += ` AND id <> ?`;
    params.push(excludeId);
  }
  const [rows] = await db.query(sql, params);
  return rows.length > 0;
}

/** เพิ่มข้อมูลใหม่ */
async function create(data) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const sql = `
      INSERT INTO tb_company 
      (company_code, business_type, branch_name, company_name_th, company_name_en, address_th, address_en, phone, tax_no)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await conn.query(sql, [
      data.company_code, data.business_type, data.branch_name,
      data.company_name_th, data.company_name_en,
      data.address_th, data.address_en, data.phone, data.tax_no
    ]);

    await conn.commit();
    return result.insertId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** แก้ไขข้อมูล และอัปเดต tb_branch ด้วย (Cascading Update) */
async function update(id, data) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. ดึง code เดิมเพื่อดูว่ามีการเปลี่ยนหรือไม่
    const [oldRows] = await conn.query('SELECT company_code FROM tb_company WHERE id = ?', [id]);
    const oldCode = oldRows[0]?.company_code;

    // 2. อัปเดต tb_company
    const sqlCompany = `
      UPDATE tb_company
      SET company_code=?, business_type=?, branch_name=?, 
          company_name_th=?, company_name_en=?, 
          address_th=?, address_en=?, phone=?, tax_no=?
      WHERE id = ?
    `;
    const [result] = await conn.query(sqlCompany, [
      data.company_code, data.business_type, data.branch_name,
      data.company_name_th, data.company_name_en,
      data.address_th, data.address_en, data.phone, data.tax_no,
      id
    ]);

    // 3. Cascading Update ไปยัง tb_branch ถ้า code เปลี่ยน
    if (oldCode && oldCode !== data.company_code) {
      const sqlBranch = `
        UPDATE tb_branch
        SET company_code = ?
        WHERE company_code = ?
      `;
      await conn.query(sqlBranch, [data.company_code, oldCode]);
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

/** ลบข้อมูล */
async function remove(id) {
  const sql = `DELETE FROM tb_company WHERE id = ?`;
  const [result] = await db.query(sql, [id]);
  return result.affectedRows > 0;
}

module.exports = {
  getAll,
  getById,
  checkCodeDuplicate,
  create,
  update,
  remove,
};