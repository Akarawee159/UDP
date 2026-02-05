'use strict';

const db = require('../../../config/database');

/** ดึงรายการข้อมูลทั้งหมด */
async function getAll() {
  const sql = `
    SELECT 
      id, supplier_code, supplier_type, branch_name,
      supplier_name, remark,
      supplier_address, contact_name, supplier_phone, contact_phone, tax_id
    FROM suppliers
    ORDER BY id ASC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

/** ดึงข้อมูลตาม ID */
async function getById(id) {
  const sql = `
    SELECT *
    FROM suppliers
    WHERE id = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [id]);
  return rows[0] || null;
}

/** ตรวจว่ามี supplier_code ซ้ำหรือไม่ */
async function checkCodeDuplicate(supplier_code, excludeId = null) {
  let sql = `SELECT id FROM suppliers WHERE supplier_code = ?`;
  const params = [supplier_code];
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
      INSERT INTO suppliers 
      (supplier_code, supplier_type, branch_name, supplier_name, remark, supplier_address, contact_name, supplier_phone, contact_phone, tax_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await conn.query(sql, [
      data.supplier_code, data.supplier_type, data.branch_name,
      data.supplier_name, data.remark,
      data.supplier_address, data.contact_name, data.supplier_phone, data.contact_phone, data.tax_id
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
    const [oldRows] = await conn.query('SELECT supplier_code FROM suppliers WHERE id = ?', [id]);
    const oldCode = oldRows[0]?.supplier_code;

    // 2. อัปเดต suppliers
    const sqlCompany = `
      UPDATE suppliers
      SET supplier_code=?, supplier_type=?, branch_name=?, 
          supplier_name=?, remark=?, 
          supplier_address=?, contact_name=?, supplier_phone=?, contact_phone=?, tax_id=?
      WHERE id = ?
    `;
    const [result] = await conn.query(sqlCompany, [
      data.supplier_code, data.supplier_type, data.branch_name,
      data.supplier_name, data.remark,
      data.supplier_address, data.contact_name, data.supplier_phone, data.contact_phone, data.tax_id,
      id
    ]);

    // 3. Cascading Update ไปยัง tb_branch ถ้า code เปลี่ยน
    if (oldCode && oldCode !== data.supplier_code) {
      const sqlBranch = `
        UPDATE tb_branch
        SET supplier_code = ?
        WHERE supplier_code = ?
      `;
      await conn.query(sqlBranch, [data.supplier_code, oldCode]);
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
  const sql = `DELETE FROM suppliers WHERE id = ?`;
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