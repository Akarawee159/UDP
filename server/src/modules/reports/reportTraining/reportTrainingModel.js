'use strict';

const db = require('../../../config/database');

const overlapSql = (start, end, params) => {
  if (start && end) {
    params.push(end, start);
    return ' AND bc.start_date <= ? AND bc.end_date >= ? ';
  }
  return '';
};

function empStatusSql(empStatus) {
  const resignExpr = 'e.resign_date';
  if (empStatus === 'current') return ` AND ${resignExpr} IS NULL `;
  if (empStatus === 'resigned') return ` AND ${resignExpr} IS NOT NULL `;
  return '';
}

async function searchEmployees({ empStatus, q, limit = 50 }) {
  const params = [];

  // ✅ ชื่อพนักงาน: titlename_th + firstname_th + ' ' + lastname_th
  const fullnameSql = `TRIM(CONCAT(COALESCE(e.titlename_th,''), COALESCE(e.firstname_th,''), ' ', COALESCE(e.lastname_th,'')))`;
  const fullnameExpr = `NULLIF(${fullnameSql}, '')`;

  let sql = `
    SELECT DISTINCT
      bd.employee_code,
      ${fullnameExpr} AS fullname_th
    FROM booking_detail bd
    LEFT JOIN employees e
      ON e.employee_code = bd.employee_code
    WHERE bd.employee_code IS NOT NULL AND bd.employee_code <> ''
  `;

  sql += empStatusSql(empStatus);

  if (q) {
    sql += ` AND (bd.employee_code LIKE ? OR ${fullnameExpr} LIKE ?) `;
    params.push(`%${q}%`, `%${q}%`);
  }

  sql += ` ORDER BY bd.employee_code ASC LIMIT ? `;
  params.push(Number(limit) || 50);

  const [rows] = await db.query(sql, params);

  return rows.map(r => {
    const code = (r.employee_code || '').toString().trim();
    const name = (r.fullname_th || '').toString().trim();
    return {
      value: code,
      label: name ? `${code} - ${name}` : code,
      employee_code: code,
      fullname_th: name || null,
    };
  });
}



async function searchCourses({ start, end, q, limit = 100 }) {
  const params = [];
  let sql = `
    SELECT
      bc.courses_code,
      bc.courses_name
    FROM booking_courses bc
    WHERE bc.courses_code IS NOT NULL AND bc.courses_code <> ''
      AND bc.courses_name IS NOT NULL AND bc.courses_name <> ''
  `;

  sql += overlapSql(start, end, params);

  if (q) {
    sql += ` AND (bc.courses_code LIKE ? OR bc.courses_name LIKE ?) `;
    params.push(`%${q}%`, `%${q}%`);
  }

  sql += `
    GROUP BY bc.courses_code, bc.courses_name
    ORDER BY bc.courses_name ASC
    LIMIT ?
  `;
  params.push(Number(limit) || 100);

  const [rows] = await db.query(sql, params);
  return rows.map(r => ({
    value: r.courses_code,
    label: `${r.courses_code} - ${r.courses_name}`.trim(),
    courses_code: r.courses_code,
    courses_name: r.courses_name,
  }));
}

async function searchBookingCodes({ start, end, q, limit = 100 }) {
  const params = [];
  let sql = `
    SELECT
      bc.booking_code,
      MAX(bc.courses_name) AS courses_name
    FROM booking_courses bc
    WHERE bc.booking_code IS NOT NULL AND bc.booking_code <> ''
  `;

  sql += overlapSql(start, end, params);

  if (q) {
    sql += ` AND (bc.booking_code LIKE ? OR bc.courses_name LIKE ?) `;
    params.push(`%${q}%`, `%${q}%`);
  }

  sql += `
    GROUP BY bc.booking_code
    ORDER BY bc.booking_code DESC
    LIMIT ?
  `;
  params.push(Number(limit) || 100);

  const [rows] = await db.query(sql, params);
  return rows.map(r => ({
    value: r.booking_code,
    label: `${r.booking_code} - ${r.courses_name || ''}`.trim(),
    booking_code: r.booking_code,
    courses_name: r.courses_name,
  }));
}


// ✅ รายงานตามบุคคล: สรุป 1 คน 1 แถว (แม้จะเลือก course ก็ยังสรุปเป็นรายคน)
async function searchPersonSummary({ start, end, empStatus, employee_code, courses_code }) {
  const params = [];

  const fullnameSql = `TRIM(CONCAT(COALESCE(e.titlename_th,''), COALESCE(e.firstname_th,''), ' ', COALESCE(e.lastname_th,'')))`;
  const fullnameExpr = `NULLIF(${fullnameSql}, '')`;
  const resignExpr = `e.resign_date`;

  let sql = `
    SELECT
      bd.employee_code,
      MAX(${fullnameExpr}) AS fullname_th,
      MAX(e.position) AS position,
      MAX(e.department) AS department,
      MAX(e.worksites) AS worksites,
      MAX(e.sign_date) AS sign_date,
      MAX(${resignExpr}) AS resign_date,
      CASE
        WHEN MAX(${resignExpr}) IS NOT NULL THEN 'ลาออกแล้ว'
        ELSE 'ปัจจุบันทำงานอยู่'
      END AS emp_status
    FROM booking_detail bd
    JOIN booking_courses bc
      ON bc.booking_code = bd.booking_code
    LEFT JOIN employees e
      ON e.employee_code = bd.employee_code
    WHERE bd.employee_code IS NOT NULL AND bd.employee_code <> ''
  `;

  sql += empStatusSql(empStatus);

  if (employee_code) {
    sql += ` AND bd.employee_code = ? `;
    params.push(employee_code);
  }

  if (courses_code) {
    sql += ` AND bc.courses_code = ? `;
    params.push(courses_code);
  }

  sql += overlapSql(start, end, params);

  sql += `
    GROUP BY bd.employee_code
    ORDER BY bd.employee_code ASC
  `;

  const [rows] = await db.query(sql, params);
  return rows;
}

// ✅ ปุ่ม + (รายบุคคล): แสดงหัวข้ออบรมทั้งหมดของคนนั้น
async function getPersonHistory({ employee_code }) {
  const sql = `
    SELECT
      bc.booking_code,
      bc.courses_code,
      bc.courses_name,
      bc.start_date,
      bc.end_date,
      bc.duration_date,
      bc.location_name,
      bc.remark
    FROM booking_detail bd
    JOIN booking_courses bc
      ON bc.booking_code = bd.booking_code
    WHERE bd.employee_code = ?
    GROUP BY
      bc.booking_code, bc.courses_code, bc.courses_name,
      bc.start_date, bc.end_date, bc.duration_date, bc.location_name, bc.remark
    ORDER BY bc.start_date DESC
  `;
  const [rows] = await db.query(sql, [employee_code]);
  return rows;
}

// ✅ รายงานตามหัวข้ออบรม: ตารางหลักเป็น “กลุ่มอบรม”
async function searchTopicGroups({ start, end, booking_code }) {
  const params = [];
  let sql = `
    SELECT
      bc.booking_code,
      bc.courses_name,
      bc.attendees,
      bc.start_date,
      bc.end_date,
      bc.duration_date,
      bc.location_name,
      bc.remark
    FROM booking_courses bc
    WHERE bc.booking_code IS NOT NULL AND bc.booking_code <> ''
  `;

  if (booking_code) {
    sql += ` AND bc.booking_code = ? `;
    params.push(booking_code);
  }

  // ใช้ alias bc เลย เพื่อ reuse overlapSql
  sql = sql.replace(/FROM booking_courses bc[\s\S]*?WHERE/, match => match); // no-op (กัน lint)

  // overlapSql เขียนสำหรับ bc alias อยู่แล้ว
  sql += overlapSql(start, end, params);

  sql += `
    GROUP BY
      bc.booking_code, bc.courses_name, bc.attendees,
      bc.start_date, bc.end_date, bc.duration_date, bc.location_name, bc.remark
    ORDER BY bc.start_date DESC
  `;

  const [rows] = await db.query(sql, params);
  return rows;
}

async function getBookingMeta({ booking_code }) {
  const sql = `
    SELECT
      booking_code,
      courses_code,
      courses_name,
      attendees,
      start_date,
      end_date,
      duration_date,
      location_name,
      remark
    FROM booking_courses
    WHERE booking_code = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [booking_code]);
  return rows?.[0] || null;
}

// ✅ ปุ่ม + (รายกลุ่มอบรม): แสดงพนักงานทั้งหมดในกลุ่มนั้น
async function getTopicMembers({ booking_code }) {
  const fullnameSql = `TRIM(CONCAT(COALESCE(e.titlename_th,''), COALESCE(e.firstname_th,''), ' ', COALESCE(e.lastname_th,'')))`;
  const fullnameExpr = `NULLIF(${fullnameSql}, '')`;
  const resignExpr = `e.resign_date`;

  const sql = `
    SELECT
      bd.booking_detail_id,
      bd.employee_code,
      ${fullnameExpr} AS fullname_th,
      e.position AS position,
      e.department AS department,
      e.worksites AS worksites,
      e.sign_date AS sign_date,
      ${resignExpr} AS resign_date,
      CASE
        WHEN ${resignExpr} IS NOT NULL THEN 'ลาออกแล้ว'
        ELSE 'ปัจจุบันทำงานอยู่'
      END AS emp_status
    FROM booking_detail bd
    LEFT JOIN employees e
      ON e.employee_code = bd.employee_code
    WHERE bd.booking_code = ?
    ORDER BY bd.employee_code ASC
  `;

  const [rows] = await db.query(sql, [booking_code]);
  return rows;
}

async function getEmployeeProfile({ employee_code }) {
  const fullnameSql = `TRIM(CONCAT(COALESCE(e.titlename_th,''), COALESCE(e.firstname_th,''), ' ', COALESCE(e.lastname_th,'')))`;
  const fullnameExpr = `NULLIF(${fullnameSql}, '')`;

  const sql = `
    SELECT
      bd.employee_code,
      ${fullnameExpr} AS fullname_th,
      e.position AS position,
      e.department AS department,
      e.worksites AS worksites,
      e.sign_date AS sign_date,
      e.resign_date AS resign_date
    FROM booking_detail bd
    LEFT JOIN employees e
      ON e.employee_code = bd.employee_code
    WHERE bd.employee_code = ?
    ORDER BY bd.booking_detail_id DESC
    LIMIT 1
  `;

  const [rows] = await db.query(sql, [employee_code]);
  return rows?.[0] || null;
}

async function getDocCodeByForUse({ for_use }) {
  // ดึงเลขที่เอกสาร เช่น A&P/F-HR-17/27-04-44
  const sql = `
    SELECT G_NAME
    FROM tb_doccode
    WHERE FOR_USE = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [for_use]);
  return rows?.[0]?.G_NAME || null;
}

module.exports = {
  searchEmployees,
  searchCourses,
  searchBookingCodes,
  searchPersonSummary,
  getPersonHistory,
  searchTopicGroups,
  getBookingMeta,
  getTopicMembers,
  getEmployeeProfile,
  getDocCodeByForUse,
};
