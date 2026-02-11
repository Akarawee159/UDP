'use strict';

const db = require('../../../config/database');

/** ดึงรายการข้อมูลทั้งหมด */
async function getAll() {
  const sql = `
    SELECT 
      supplier_code, supplier_code2, supplier_type, branch_name,
      supplier_name, remark,
      supplier_address, contact_name, supplier_phone, contact_phone, tax_id
    FROM suppliers
    ORDER BY supplier_code ASC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

/** ดึงข้อมูลตาม Code */
async function getByCode(code) {
  const sql = `
    SELECT *
    FROM suppliers
    WHERE supplier_code = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [code]);
  return rows[0] || null;
}

/** * ตรวจสอบค่าซ้ำ (ใช้ได้ทั้ง supplier_code และ supplier_code2)
 * @param {string} field - ชื่อ column ที่ต้องการเช็ค ('supplier_code' หรือ 'supplier_code2')
 * @param {string} value - ค่าที่ต้องการเช็ค
 * @param {string} excludeCode - รหัสเดิม (กรณีแก้ไข) เพื่อไม่ให้เช็คเจอตัวเอง
 */
async function checkDuplicate(field, value, excludeCode = null) {
  // ป้องกัน SQL Injection โดยการ allow เฉพาะชื่อ field ที่กำหนด
  const allowedFields = ['supplier_code', 'supplier_code2'];
  if (!allowedFields.includes(field)) throw new Error('Invalid field check');

  let sql = `SELECT supplier_code FROM suppliers WHERE ${field} = ?`;
  const params = [value];

  if (excludeCode) {
    sql += ` AND supplier_code <> ?`;
    params.push(excludeCode);
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
      (supplier_code, supplier_code2, supplier_type, branch_name, supplier_name, remark, supplier_address, contact_name, supplier_phone, contact_phone, tax_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await conn.query(sql, [
      data.supplier_code, data.supplier_code2, data.supplier_type, data.branch_name,
      data.supplier_name, data.remark,
      data.supplier_address, data.contact_name, data.supplier_phone, data.contact_phone, data.tax_id
    ]);

    await conn.commit();
    return data.supplier_code; // คืนค่าเป็น code แทน id
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** แก้ไขข้อมูล (ระวัง: ถ้าเปลี่ยน supplier_code ที่เป็น PK ต้องจัดการให้ดี) */
async function update(oldCode, data) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const sql = `
      UPDATE suppliers
      SET supplier_code=?, supplier_code2=?, supplier_type=?, branch_name=?, 
          supplier_name=?, remark=?, 
          supplier_address=?, contact_name=?, supplier_phone=?, contact_phone=?, tax_id=?
      WHERE supplier_code = ?
    `;
    const [result] = await conn.query(sql, [
      data.supplier_code, data.supplier_code2, data.supplier_type, data.branch_name,
      data.supplier_name, data.remark,
      data.supplier_address, data.contact_name, data.supplier_phone, data.contact_phone, data.tax_id,
      oldCode // ใช้ oldCode ใน Where Clause
    ]);

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
async function remove(code) {
  const sql = `DELETE FROM suppliers WHERE supplier_code = ?`;
  const [result] = await db.query(sql, [code]);
  return result.affectedRows > 0;
}

module.exports = {
  getAll,
  getByCode,
  checkDuplicate,
  create,
  update,
  remove,
};