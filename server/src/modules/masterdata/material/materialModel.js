// src/modules/settings/material/materialModel.js
'use strict';

const db = require('../../../config/database');

// ✅ Helper: สร้างเวลาปัจจุบันเป็น Timezone ไทย (UTC+7)
const getThaiNow = () => {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
};

/** ดึงรายการทั้งหมด */
async function getAll() {
  // ใช้ LEFT JOIN กับ tb_erp_status
  // โดยจับคู่ is_status = G_CODE และ fix G_USE = 'M1'
  const sql = `
      SELECT 
        m.material_id, m.material_code, m.material_name, m.material_source, m.material_usedfor, m.material_type,
        m.supplier_name, m.material_brand, m.material_color, m.material_model, m.material_remark,
        m.material_detail, m.material_feature, m.material_image, m.currency,
        m.quantity_mainunit, m.mainunit_name, m.quantity_subunit, m.subunit_name,
        m.minimum_order, m.minstock, m.maxstock, m.is_status,
        m.material_width, m.material_width_unit, m.material_length, m.material_length_unit,
        m.material_height, m.material_height_unit, m.material_capacity, m.material_capacity_unit,
        m.material_weight, m.material_weight_unit,
        
        -- ✅ [เพิ่ม] ดึงข้อมูล Drawing 1-6
        m.drawing_001, m.drawing_002, m.drawing_003, m.drawing_004, m.drawing_005, m.drawing_006,

        -- ดึงค่าจากตาราง Status
        s.G_NAME as status_name,
        s.G_DESCRIPT as status_class
      FROM materials m
      LEFT JOIN tb_erp_status s 
        ON m.is_status = s.G_CODE 
        AND s.G_USE = 'M1'
      ORDER BY m.material_id ASC
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
  const sqlUnits = `SELECT G_NAME as name FROM tb_counting_unit ORDER BY G_NAME ASC`;
  const sqlCurrencies = `SELECT G_NAME as name FROM tb_currency ORDER BY G_NAME ASC`;
  // ✅ เพิ่ม: ดึงข้อมูลบรรจุภัณฑ์ทั้งหมด
  const sqlPackagings = `SELECT * FROM tb_packaging ORDER BY G_NAME ASC`;

  const [units] = await db.query(sqlUnits).catch(() => [[]]);
  const [currencies] = await db.query(sqlCurrencies).catch(() => [[]]);
  const [packagings] = await db.query(sqlPackagings).catch(() => [[]]);

  return { units, currencies, packagings };
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

async function create(data) {
  const now = getThaiNow();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [lastRows] = await conn.query('SELECT material_id FROM materials ORDER BY material_id DESC LIMIT 1 FOR UPDATE');
    const nextId = lastRows.length ? Number(lastRows[0].material_id) + 1 : 1;

    const sql = `
      INSERT INTO materials (
        material_id, material_code, material_name, material_source, material_usedfor, material_type,
        supplier_name, material_brand, material_color, material_model, material_remark,
        material_detail, material_feature, material_image, currency,
        quantity_mainunit, mainunit_name, quantity_subunit, subunit_name,
        minimum_order, minstock, maxstock, is_status,
        created_by, created_at,
        material_width, material_width_unit, material_length, material_length_unit,
        material_height, material_height_unit, material_capacity, material_capacity_unit,
        material_weight, material_weight_unit,
        drawing_001, drawing_002, drawing_003, drawing_004, drawing_005, drawing_006
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await conn.query(sql, [
      nextId, data.material_code, data.material_name, data.material_source, data.material_usedfor, data.material_type,
      data.supplier_name, data.material_brand, data.material_color, data.material_model, data.material_remark,
      data.material_detail, data.material_feature, data.material_image, data.currency,
      data.quantity_mainunit, data.mainunit_name, data.quantity_subunit, data.subunit_name,
      data.minimum_order, data.minstock, data.maxstock, data.is_status,
      data.created_by, now,
      data.material_width, data.material_width_unit, data.material_length, data.material_length_unit,
      data.material_height, data.material_height_unit, data.material_capacity, data.material_capacity_unit,
      data.material_weight, data.material_weight_unit,
      // Drawing Values
      data.drawing_001 || '', data.drawing_002 || '', data.drawing_003 || '',
      data.drawing_004 || '', data.drawing_005 || '', data.drawing_006 || ''
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

async function update(material_id, data) {
  const now = getThaiNow(); // เรียกใช้เวลาไทย

  const sql = `
    UPDATE materials
    SET 
      material_code = ?, material_name = ?, material_source = ?, material_usedfor = ?, material_type = ?,
      supplier_name = ?, material_brand = ?, material_color = ?, material_model = ?, material_remark = ?,
      material_detail = ?, material_feature = ?, material_image = ?, currency = ?,
      quantity_mainunit = ?, mainunit_name = ?, quantity_subunit = ?, subunit_name = ?,
      minimum_order = ?, minstock = ?, maxstock = ?, is_status = ?,
      updated_by = ?, updated_at = ?,
      material_width = ?, material_width_unit = ?, material_length = ?, material_length_unit = ?,
      material_height = ?, material_height_unit = ?, material_capacity = ?, material_capacity_unit = ?,
      material_weight = ?, material_weight_unit = ?,
      drawing_001 = ?, drawing_002 = ?, drawing_003 = ?, 
      drawing_004 = ?, drawing_005 = ?, drawing_006 = ?
    WHERE material_id = ?
  `;

  const [result] = await db.query(sql, [
    data.material_code, data.material_name, data.material_source, data.material_usedfor, data.material_type,
    data.supplier_name, data.material_brand, data.material_color, data.material_model, data.material_remark,
    data.material_detail, data.material_feature, data.material_image, data.currency,
    data.quantity_mainunit, data.mainunit_name, data.quantity_subunit, data.subunit_name,
    data.minimum_order, data.minstock, data.maxstock, data.is_status,
    data.updated_by, now,
    data.material_width, data.material_width_unit, data.material_length, data.material_length_unit,
    data.material_height, data.material_height_unit, data.material_capacity, data.material_capacity_unit,
    data.material_weight, data.material_weight_unit,
    data.drawing_001 || '', data.drawing_002 || '', data.drawing_003 || '',
    data.drawing_004 || '', data.drawing_005 || '', data.drawing_006 || '',
    material_id
  ]);
  return result.affectedRows > 0;
}

/** ลบข้อมูล */
async function remove(material_id) {
  const sql = `DELETE FROM materials WHERE material_id = ?`;
  const [result] = await db.query(sql, [material_id]);
  return result.affectedRows > 0;
}

/** * ✅ เพิ่ม/แก้ไข: อัปเดตรูปภาพใน tb_asset_lists 
 * กรณีมีรูปเดิม -> เช็ค partCode และ asset_img ต้องตรงกัน
 * กรณีไม่มีรูปเดิม -> เช็คแค่ partCode แล้วอัปเดตทั้งหมด
 */
async function updateAssetImage(material_code, old_image, new_image) {
  // ต้องมี material_code เสมอ
  if (!material_code) return;

  let sql = `UPDATE tb_asset_lists SET asset_img = ? WHERE partCode = ?`;
  const params = [new_image || '', material_code];

  // ถ้ามีรูปเดิม ให้จำกัดวง update เฉพาะรายการที่ใช้รูปเดิมนั้น
  if (old_image) {
    sql += ` AND asset_img = ?`;
    params.push(old_image);
  }

  // ถ้า old_image เป็น null/empty จะ update โดยอิงแค่ partCode
  await db.query(sql, params);
}

/** * ✅ Update เฉพาะ Drawing
 * targetColumn: 'asset_dmg_001' ... 'asset_dmg_006'
 */
async function updateAssetDrawing(material_code, targetColumn, old_image, new_image) {
  if (!material_code) return;

  // Whitelist column name เพื่อป้องกัน SQL Injection
  const allowedCols = [
    'asset_dmg_001', 'asset_dmg_002', 'asset_dmg_003',
    'asset_dmg_004', 'asset_dmg_005', 'asset_dmg_006'
  ];
  if (!allowedCols.includes(targetColumn)) return;

  let sql = `UPDATE tb_asset_lists SET ${targetColumn} = ? WHERE partCode = ?`;
  const params = [new_image || '', material_code];

  if (old_image) {
    sql += ` AND ${targetColumn} = ?`;
    params.push(old_image);
  }

  await db.query(sql, params);
}

module.exports = {
  getAll,
  getById,
  getDropdownOptions,
  checkCodeDuplicate,
  create,
  update,
  remove,
  updateAssetImage,
  updateAssetDrawing,
};