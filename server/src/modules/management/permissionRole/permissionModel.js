'use strict';
const db = require('../../../config/database');

async function getAll() {
  const sql = `
    SELECT permission_id, group_name, main_menu, sub_menu, action_permission, privilege_access, is_status 
    FROM permission_group
    ORDER BY permission_id DESC
  `;
  const [rows] = await db.query(sql);
  return rows;
}

async function getById(id) {
  const sql = `
    SELECT permission_id, group_name, main_menu, sub_menu, action_permission, privilege_access, is_status
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

async function create({ groupName, mainIds = [], subIds = [], actionPermissions = [], privilege_access = 'Normal' }) {
  const sql = `
    INSERT INTO permission_group (group_name, main_menu, sub_menu, action_permission, privilege_access, is_status)
    VALUES (?, ?, ?, ?, ?, '0')
  `;
  const params = [
    groupName,
    JSON.stringify(mainIds),
    JSON.stringify(subIds),
    JSON.stringify(actionPermissions),
    privilege_access
  ];
  const [res] = await db.query(sql, params);
  return res.insertId;
}

async function updateById(id, { groupName, mainIds = [], subIds = [], actionPermissions = [], privilege_access }) {
  const sql = `
    UPDATE permission_group
    SET group_name = ?, main_menu = ?, sub_menu = ?, action_permission = ?, privilege_access = ?
    WHERE permission_id = ?
  `;
  const params = [
    groupName,
    JSON.stringify(mainIds),
    JSON.stringify(subIds),
    JSON.stringify(actionPermissions),
    privilege_access,
    id
  ];
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
    SELECT pg.permission_id, pg.group_name, pg.main_menu, pg.sub_menu, pg.action_permission, pg.privilege_access
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

// ✅ [เพิ่มใหม่] ฟังก์ชันสำหรับ Reset สถานะพนักงานและเตะออกจากระบบตามชื่อกลุ่ม
async function revokeAndResetStatusByGroup(groupName) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. หา Employee ID ของคนที่มี Role นี้ (เพื่อส่งคืนให้ Controller ไปยิง Socket)
    const [empRows] = await conn.query(
      `SELECT employee_id FROM employees WHERE TRIM(LOWER(permission_role)) = TRIM(LOWER(?))`,
      [groupName]
    );
    const empIds = empRows.map(r => r.employee_id);

    if (empIds.length > 0) {
      // 2. Update Status = 1 (Active) & Bump Token Version (Invalidate Token เดิม)
      await conn.query(
        `UPDATE employees SET is_status = 1, token_version = token_version + 1 WHERE TRIM(LOWER(permission_role)) = TRIM(LOWER(?))`,
        [groupName]
      );

      // 3. ลบ Refresh Tokens ทั้งหมดของคนกลุ่มนี้
      await conn.query(
        `DELETE FROM refresh_tokens WHERE employee_id IN (?)`,
        [empIds]
      );
    }

    await conn.commit();
    return empIds;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
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
  revokeAndResetStatusByGroup,
};