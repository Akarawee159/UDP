// .src/modules/reports/reportEmployee/reportEmployeeModel.js
'use strict';

const db = require('../../../config/database');

// Helper to build WHERE clauses dynamically
const buildConditions = (params) => {
  let sql = 'WHERE t1.employee_id != 1';
  const values = [];

  if (params.employee_code) {
    sql += ' AND t1.employee_code = ?';
    values.push(params.employee_code);
  }
  if (params.fullname) {
    sql += ` AND CONCAT(t1.titlename_th, t1.firstname_th, ' ', t1.lastname_th) LIKE ?`;
    values.push(`%${params.fullname}%`);
  }
  if (params.id_card) {
    sql += ' AND t2.id_card LIKE ?';
    values.push(`%${params.id_card}%`);
  }
  if (params.gender) {
    sql += ' AND t2.gender = ?';
    values.push(params.gender);
  }
  if (params.working_status) {
    sql += ' AND t1.working_status = ?';
    values.push(params.working_status);
  }
  if (params.military_status) {
    sql += ' AND t2.military_status = ?';
    values.push(params.military_status);
  }
  if (params.worksites) {
    sql += ' AND t1.worksites = ?';
    values.push(params.worksites);
  }
  if (params.department) {
    sql += ' AND t1.department = ?';
    values.push(params.department);
  }
  if (params.position) {
    sql += ' AND t1.position = ?';
    values.push(params.position);
  }
  if (params.resign_reason) {
    sql += ' AND t1.resign_reason = ?';
    values.push(params.resign_reason);
  }
  if (params.start_date_from && params.start_date_to) {
    sql += ' AND (t1.sign_date BETWEEN ? AND ?)';
    values.push(params.start_date_from, params.start_date_to);
  }

  return { sql, values };
};

async function search(params) {
  const { sql: whereSql, values } = buildConditions(params);

  const sql = `
        SELECT 
            t1.employee_id,
            t1.employee_code,
            t1.titlename_th,
            t1.firstname_th,
            t1.lastname_th,
            t1.sign_date,
            t1.resign_date,
            t1.resign_reason,
            t1.worksites,
            t1.department,
            t1.position,
            t1.employee_type,
            t1.working_status,
            t1.person_remark,
            t2.id_card,
            t2.gender,
            t2.military_status
        FROM employees t1
        LEFT JOIN employees_profile t2 ON t1.employee_id = t2.employee_id
        ${whereSql}
        ORDER BY t1.employee_code ASC
    `;

  const [rows] = await db.query(sql, values);
  return rows;
}

async function getAll() {
  return search({});
}

// ✅ NEW: Get Log/Report for a specific employee
async function getLogByEmployeeId(employeeId) {
  const sql = `
        SELECT 
            log.employee_code,
            -- ✅ ใช้ CONCAT_WS แทน CONCAT เพื่อป้องกันปัญหา NULL ทำให้ชื่อหาย และดึงจาก log โดยตรง
            CONCAT_WS(' ', log.titlename_th, log.firstname_th, log.lastname_th) AS fullname_th,
            log.id_card,
            log.worksites,
            log.department,
            log.position,
            log.employee_type,
            log.working_status,
            log.military_status,
            
            -- Resolve Created By Name (ยังคง Join เพื่อให้รู้ว่าใครเป็นคนทำรายการ)
            CONCAT(creator.titlename_th, ' ', creator.firstname_th, ' ', creator.lastname_th) AS created_by_name,
            log.created_at,
            
            -- Resolve Updated By Name
            CONCAT(updater.titlename_th, ' ', updater.firstname_th, ' ', updater.lastname_th) AS updated_by_name,
            log.updated_at
            
        FROM employees_log log
        
        -- ❌ ลบ Join employees_profile ออก (เพราะข้อมูลมีใน log แล้ว)
        
        -- Join Employees เฉพาะเพื่อหาชื่อคนสร้าง/แก้ไข (creator/updater)
        LEFT JOIN employees creator ON log.created_by = creator.employee_id
        LEFT JOIN employees updater ON log.updated_by = updater.employee_id
        
        WHERE log.employee_id = ?
        ORDER BY log.updated_at DESC
    `;

  const [rows] = await db.query(sql, [employeeId]);
  return rows;
}

// Fetch distinct values for dropdowns (Dynamic)
async function getOptions() {
  const [worksites] = await db.query("SELECT DISTINCT worksites FROM employees WHERE worksites IS NOT NULL AND worksites != '' ORDER BY worksites");
  const [departments] = await db.query("SELECT DISTINCT department FROM employees WHERE department IS NOT NULL AND department != '' ORDER BY department");
  const [positions] = await db.query("SELECT DISTINCT position FROM employees WHERE position IS NOT NULL AND position != '' ORDER BY position");
  const [reasons] = await db.query("SELECT DISTINCT resign_reason FROM employees WHERE resign_reason IS NOT NULL AND resign_reason != '' ORDER BY resign_reason");

  const [genders] = await db.query("SELECT DISTINCT gender FROM employees_profile WHERE gender IS NOT NULL AND gender != '' ORDER BY gender");
  const [workingStatuses] = await db.query("SELECT DISTINCT working_status FROM employees WHERE working_status IS NOT NULL AND working_status != '' ORDER BY working_status");
  const [militaryStatuses] = await db.query("SELECT DISTINCT military_status FROM employees_profile WHERE military_status IS NOT NULL AND military_status != '' ORDER BY military_status");

  const [employees] = await db.query(`
        SELECT employee_code, firstname_th, lastname_th 
        FROM employees 
        WHERE employee_code IS NOT NULL 
        AND employee_code != ''
        AND employee_id != 1
        AND is_status != 99
        ORDER BY employee_code ASC
    `);

  return {
    worksites,
    departments,
    positions,
    reasons,
    genders,
    workingStatuses,
    militaryStatuses,
    employees
  };
}

module.exports = {
  getAll,
  search,
  getOptions,
  getLogByEmployeeId
};