// src/modules/settings/packaging/packagingModel.js
'use strict';

const db = require('../../../config/database');

/** ดึงรายการทั้งหมด */
async function getAll() {
  const sql = `
    SELECT 
      G_ID, G_CODE, G_NAME,
      G_WIDTH, G_WIDTH_UNIT,
      G_LENGTH, G_LENGTH_UNIT,
      G_HEIGHT, G_HEIGHT_UNIT,
      G_CAPACITY, G_CAPACITY_UNIT,
      G_WEIGHT, G_WEIGHT_UNIT
    FROM tb_packaging
    ORDER BY G_ID ASC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

/** ดึงข้อมูลตาม ID */
async function getById(G_ID) {
  const sql = `
    SELECT *
    FROM tb_packaging
    WHERE G_ID = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [G_ID]);
  return rows[0] || null;
}

/** ตรวจ Code ซ้ำ */
async function checkCodeDuplicate(G_CODE, excludeId = null) {
  let sql = `SELECT G_ID FROM tb_packaging WHERE G_CODE = ?`;
  const params = [G_CODE];
  if (excludeId != null) {
    sql += ` AND G_ID <> ?`;
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
      'SELECT G_ID FROM tb_packaging ORDER BY G_ID DESC LIMIT 1 FOR UPDATE'
    );
    const nextId = lastRows.length ? Number(lastRows[0].G_ID) + 1 : 1;

    const sql = `
      INSERT INTO tb_packaging (
        G_ID, G_CODE, G_NAME,
        G_WIDTH, G_WIDTH_UNIT,
        G_LENGTH, G_LENGTH_UNIT,
        G_HEIGHT, G_HEIGHT_UNIT,
        G_CAPACITY, G_CAPACITY_UNIT,
        G_WEIGHT, G_WEIGHT_UNIT
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await conn.query(sql, [
      nextId, data.G_CODE, data.G_NAME,
      data.G_WIDTH, data.G_WIDTH_UNIT,
      data.G_LENGTH, data.G_LENGTH_UNIT,
      data.G_HEIGHT, data.G_HEIGHT_UNIT,
      data.G_CAPACITY, data.G_CAPACITY_UNIT,
      data.G_WEIGHT, data.G_WEIGHT_UNIT
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
async function update(G_ID, data) {
  const sql = `
    UPDATE tb_packaging
    SET 
      G_CODE = ?, G_NAME = ?,
      G_WIDTH = ?, G_WIDTH_UNIT = ?,
      G_LENGTH = ?, G_LENGTH_UNIT = ?,
      G_HEIGHT = ?, G_HEIGHT_UNIT = ?,
      G_CAPACITY = ?, G_CAPACITY_UNIT = ?,
      G_WEIGHT = ?, G_WEIGHT_UNIT = ?
    WHERE G_ID = ?
  `;
  const [result] = await db.query(sql, [
    data.G_CODE, data.G_NAME,
    data.G_WIDTH, data.G_WIDTH_UNIT,
    data.G_LENGTH, data.G_LENGTH_UNIT,
    data.G_HEIGHT, data.G_HEIGHT_UNIT,
    data.G_CAPACITY, data.G_CAPACITY_UNIT,
    data.G_WEIGHT, data.G_WEIGHT_UNIT,
    G_ID
  ]);
  return result.affectedRows > 0;
}

async function remove(G_ID) {
  const sql = `DELETE FROM tb_packaging WHERE G_ID = ?`;
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