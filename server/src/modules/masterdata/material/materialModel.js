// src/modules/settings/material/materialModel.js
'use strict';

const db = require('../../../config/database');

// ... (getAll, getById, getDropdownOptions, checkCodeDuplicate เหมือนเดิม) ...
/** ดึงรายการทั้งหมด */
async function getAll() {
  const sql = `
      SELECT 
        material_id, material_code, material_name, material_source, material_usedfor, material_type,
        supplier_name, material_brand, material_color, material_model,
        material_feature, material_image, currency,
        quantity_mainunit, mainunit_name, quantity_subunit, subunit_name,
        minimum_order, minstock, maxstock, is_status
      FROM materials
      ORDER BY material_id ASC
    `;
  const [rows] = await db.query(sql);
  return rows;
}

/** ดึงข้อมูลตาม ID */
async function getById(material_id) {
  const sql = `
      SELECT *
      FROM materials
      WHERE material_id = ?
      LIMIT 1
    `;
  const [rows] = await db.query(sql, [material_id]);
  return rows[0] || null;
}

/** ดึงตัวเลือกสำหรับ Dropdown (หน่วยและสกุลเงิน) */
async function getDropdownOptions() {
  // ดึงหน่วยนับจาก tb_counting_unit
  const sqlUnits = `SELECT G_NAME as name FROM tb_counting_unit ORDER BY G_NAME ASC`;
  // ดึงสกุลเงินจาก tb_currency
  const sqlCurrencies = `SELECT G_NAME as name FROM tb_currency ORDER BY G_NAME ASC`;

  const [units] = await db.query(sqlUnits).catch(() => [[]]);
  const [currencies] = await db.query(sqlCurrencies).catch(() => [[]]);

  return { units, currencies };
}

/** ตรวจว่ามี material_code ซ้ำหรือไม่ */
async function checkCodeDuplicate(material_code, excludeId = null) {
  let sql = `SELECT material_id FROM materials WHERE material_code = ?`;
  const params = [material_code];
  if (excludeId != null) {
    sql += ` AND material_id <> ?`;
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

    const [lastRows] = await conn.query(
      'SELECT material_id FROM materials ORDER BY material_id DESC LIMIT 1 FOR UPDATE'
    );
    const nextId = lastRows.length ? Number(lastRows[0].material_id) + 1 : 1;

    // ✅ แก้ไข: Insert เฉพาะ created_by และ created_at
    // ตัด updated_by, updated_at ออกจากคำสั่ง SQL
    const sql = `
      INSERT INTO materials (
        material_id, material_code, material_name, material_source, material_usedfor, material_type,
        supplier_name, material_brand, material_color, material_model,
        material_feature, material_image, currency,
        quantity_mainunit, mainunit_name, quantity_subunit, subunit_name,
        minimum_order, minstock, maxstock, is_status,
        created_by, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    await conn.query(sql, [
      nextId,
      data.material_code,
      data.material_name,
      data.material_source,
      data.material_usedfor,
      data.material_type,
      data.supplier_name,
      data.material_brand,
      data.material_color,
      data.material_model,
      data.material_feature,
      data.material_image,
      data.currency,
      data.quantity_mainunit,
      data.mainunit_name,
      data.quantity_subunit,
      data.subunit_name,
      data.minimum_order,
      data.minstock,
      data.maxstock,
      data.is_status,
      data.created_by // ใส่เฉพาะ created_by
    ]);

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
async function update(material_id, data) {
  // ✅ Update: บันทึก updated_by และ updated_at ตามเดิม
  const sql = `
    UPDATE materials
    SET 
      material_code = ?, material_name = ?, material_source = ?, material_usedfor = ?, material_type = ?,
      supplier_name = ?, material_brand = ?, material_color = ?, material_model = ?,
      material_feature = ?, material_image = ?, currency = ?,
      quantity_mainunit = ?, mainunit_name = ?, quantity_subunit = ?, subunit_name = ?,
      minimum_order = ?, minstock = ?, maxstock = ?, is_status = ?,
      updated_by = ?, updated_at = NOW()
    WHERE material_id = ?
  `;

  const [result] = await db.query(sql, [
    data.material_code,
    data.material_name,
    data.material_source,
    data.material_usedfor,
    data.material_type,
    data.supplier_name,
    data.material_brand,
    data.material_color,
    data.material_model,
    data.material_feature,
    data.material_image,
    data.currency,
    data.quantity_mainunit,
    data.mainunit_name,
    data.quantity_subunit,
    data.subunit_name,
    data.minimum_order,
    data.minstock,
    data.maxstock,
    data.is_status,
    data.updated_by, // รับค่าจาก Controller
    material_id
  ]);
  return result.affectedRows > 0;
}

// ... (remove และ module.exports เหมือนเดิม) ...
/** ลบข้อมูล */
async function remove(material_id) {
  const sql = `DELETE FROM materials WHERE material_id = ?`;
  const [result] = await db.query(sql, [material_id]);
  return result.affectedRows > 0;
}

module.exports = {
  getAll,
  getById,
  getDropdownOptions,
  checkCodeDuplicate,
  create,
  update,
  remove,
};