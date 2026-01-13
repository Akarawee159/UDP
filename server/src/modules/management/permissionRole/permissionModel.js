'use strict';
const db = require('../../../config/database');

async function getAll() {
  const sql = `
    SELECT permission_id, group_name, main_menu, sub_menu, action_permission, is_status 
    FROM permission_group
    ORDER BY permission_id DESC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

async function getById(id) {
  const sql = `
    SELECT permission_id, group_name, main_menu, sub_menu, action_permission, is_status
    FROM permission_group
    WHERE permission_id = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [id]);
  return rows?.[0] || null;
}

async function existsByName(groupName) {
  const sql = `
    SELECT COUNT(*) AS c
    FROM permission_group
    WHERE TRIM(LOWER(group_name)) = TRIM(LOWER(?))
  `;
  const [rows] = await db.query(sql, [groupName]);
  return (rows?.[0]?.c || 0) > 0;
}

async function existsByNameExcludingId(id, groupName) {
  const sql = `
    SELECT COUNT(*) AS c
    FROM permission_group
    WHERE permission_id <> ?
      AND TRIM(LOWER(group_name)) = TRIM(LOWER(?))
  `;
  const [rows] = await db.query(sql, [id, groupName]);
  return (rows?.[0]?.c || 0) > 0;
}

async function create({ groupName, mainIds = [], subIds = [], actionPermissions = [] }) {
  const sql = `
    INSERT INTO permission_group (group_name, main_menu, sub_menu, action_permission, is_status)
    VALUES (?, ?, ?, ?, '0')
  `;
  const params = [groupName, JSON.stringify(mainIds), JSON.stringify(subIds), JSON.stringify(actionPermissions)];
  const [res] = await db.query(sql, params);
  return res.insertId;
}

async function updateById(id, { groupName, mainIds = [], subIds = [], actionPermissions = [] }) {
  const sql = `
    UPDATE permission_group
    SET group_name = ?, main_menu = ?, sub_menu = ?, action_permission = ?
    WHERE permission_id = ?
  `;
  const params = [groupName, JSON.stringify(mainIds), JSON.stringify(subIds), JSON.stringify(actionPermissions), id];
  const [res] = await db.query(sql, params);
  return res.affectedRows;
}

async function deleteById(id) {
  const sql = `DELETE FROM permission_group WHERE permission_id = ?`;
  const [res] = await db.query(sql, [id]);
  return res.affectedRows;
}

async function getByGroupName(groupName) {
  const sql = `
    SELECT permission_id, group_name, main_menu, sub_menu, action_permission
    FROM permission_group
    WHERE TRIM(LOWER(group_name)) = TRIM(LOWER(?))
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [groupName]);
  return rows?.[0] || null;
}

async function getMenusByEmployeeId(employeeId) {
  const sql = `
    SELECT pg.permission_id, pg.group_name, pg.main_menu, pg.sub_menu, pg.action_permission
    FROM employees e
    LEFT JOIN permission_group pg
      ON TRIM(LOWER(pg.group_name)) = TRIM(LOWER(e.permission_role))
    WHERE e.employee_id = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [employeeId]);
  return rows?.[0] || null;
}

async function updateStatusById(id, status) {
  const sql = `UPDATE permission_group SET is_status = ? WHERE permission_id = ?`;
  const [res] = await db.query(sql, [status, id]);
  return res.affectedRows;
}

module.exports = {
  getAll,
  getById,
  existsByName,
  existsByNameExcludingId,
  create,
  updateById,
  deleteById,
  getByGroupName,
  getMenusByEmployeeId,
  updateStatusById,
};