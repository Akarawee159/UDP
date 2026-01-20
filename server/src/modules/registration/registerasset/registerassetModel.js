// src/modules/registration/registerasset/registerboxModel.js
'use strict';

const db = require('../../../config/database');

/** ดึงรายการโซนทั้งหมด */
async function getAll() {
  const sql = `
    SELECT asset_id, asset_code, asset_detail
    FROM tb_asset_lists
    ORDER BY asset_id ASC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

/** ดึงข้อมูลโซนตาม asset_id */
async function getById(asset_id) {
  const sql = `
    SELECT asset_id, asset_code, asset_detail
    FROM tb_asset_lists
    WHERE asset_id = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [asset_id]);
  return rows[0] || null;
}

/** ตรวจว่ามี asset_code ซ้ำหรือไม่ */
async function checkCodeDuplicate(asset_code, excludeId = null) {
  let sql = `SELECT asset_id FROM tb_asset_lists WHERE asset_code = ?`;
  const params = [asset_code];
  if (excludeId != null) {
    sql += ` AND asset_id <> ?`;
    params.push(excludeId);
  }
  const [rows] = await db.query(sql, params);
  return rows.length > 0;
}

/** เพิ่มข้อมูลใหม่ */
async function create({ asset_code, asset_detail }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [lastRows] = await conn.query(
      'SELECT asset_id FROM tb_asset_lists ORDER BY asset_id DESC LIMIT 1 FOR UPDATE'
    );

    const nextId = lastRows.length ? Number(lastRows[0].asset_id) + 1 : 1;

    const sql = `
      INSERT INTO tb_asset_lists (asset_id, asset_code, asset_detail)
      VALUES (?, ?, ?)
    `;
    await conn.query(sql, [nextId, asset_code, asset_detail]);

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
async function update(asset_id, { asset_code, asset_detail }) {
  const sql = `
    UPDATE tb_asset_lists
    SET asset_code = ?, asset_detail = ?
    WHERE asset_id = ?
  `;
  const [result] = await db.query(sql, [asset_code, asset_detail, asset_id]);
  return result.affectedRows > 0;
}

/** ลบข้อมูล */
async function remove(asset_id) {
  const sql = `DELETE FROM tb_asset_lists WHERE asset_id = ?`;
  const [result] = await db.query(sql, [asset_id]);
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