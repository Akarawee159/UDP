// src/modules/settings/countingunit/countingunitModel.js
'use strict';

const db = require('../../../config/database');

/** ดึงรายการโซนทั้งหมด */
async function getAll() {
  const sql = `
    SELECT G_ID, G_CODE, G_NAME
    FROM tb_counting_unit
    ORDER BY G_ID ASC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

/** ดึงข้อมูลโซนตาม G_ID */
async function getById(G_ID) {
  const sql = `
    SELECT G_ID, G_CODE, G_NAME
    FROM tb_counting_unit
    WHERE G_ID = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [G_ID]);
  return rows[0] || null;
}

/** ตรวจว่ามี G_CODE ซ้ำหรือไม่ */
async function checkCodeDuplicate(G_CODE, excludeId = null) {
  let sql = `SELECT G_ID FROM tb_counting_unit WHERE G_CODE = ?`;
  const params = [G_CODE];
  if (excludeId != null) {
    sql += ` AND G_ID <> ?`;
    params.push(excludeId);
  }
  const [rows] = await db.query(sql, params);
  return rows.length > 0;
}

/** เพิ่มข้อมูลใหม่ */
async function create({ G_CODE, G_NAME }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [lastRows] = await conn.query(
      'SELECT G_ID FROM tb_counting_unit ORDER BY G_ID DESC LIMIT 1 FOR UPDATE'
    );

    const nextId = lastRows.length ? Number(lastRows[0].G_ID) + 1 : 1;

    const sql = `
      INSERT INTO tb_counting_unit (G_ID, G_CODE, G_NAME)
      VALUES (?, ?, ?)
    `;
    await conn.query(sql, [nextId, G_CODE, G_NAME]);

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
async function update(G_ID, { G_CODE, G_NAME }) {
  const sql = `
    UPDATE tb_counting_unit
    SET G_CODE = ?, G_NAME = ?
    WHERE G_ID = ?
  `;
  const [result] = await db.query(sql, [G_CODE, G_NAME, G_ID]);
  return result.affectedRows > 0;
}

/** ลบข้อมูล */
async function remove(G_ID) {
  const sql = `DELETE FROM tb_counting_unit WHERE G_ID = ?`;
  const [result] = await db.query(sql, [G_ID]);
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