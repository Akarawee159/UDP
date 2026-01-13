// .src/modules/masterdata/employee/employeeModel.js
'use strict';
const db = require('../../../config/database');

let _empColumnsCache = null;
let _empProfileColumnsCache = null;
let _empWorkhistoryColumnsCache = null;
let _empRelativesColumnsCache = null;
let _empLogColumnsCache = null; // ✅ cache สำหรับ employees_log

// ดึงชื่อคอลัมน์ของตาราง employees มาแคชไว้
async function getEmployeeColumns() {
  if (_empColumnsCache) return _empColumnsCache;
  const [rows] = await db.query('SHOW COLUMNS FROM employees');
  _empColumnsCache = new Set(rows.map(r => r.Field));
  return _empColumnsCache;
}

// ดึงชื่อคอลัมน์ของตาราง employees_profile มาแคชไว้
async function getEmployeeProfileColumns() {
  if (_empProfileColumnsCache) return _empProfileColumnsCache;
  const [rows] = await db.query('SHOW COLUMNS FROM employees_profile');
  _empProfileColumnsCache = new Set(rows.map(r => r.Field));
  return _empProfileColumnsCache;
}

// ดึงชื่อคอลัมน์ของ employees_log (ใช้กับการเก็บ log)
async function getEmployeeLogColumns() {
  if (_empLogColumnsCache) return _empLogColumnsCache;
  const [rows] = await db.query('SHOW COLUMNS FROM employees_log');
  _empLogColumnsCache = new Set(rows.map(r => r.Field));
  return _empLogColumnsCache;
}

// รันคำสั่ง SQL แบบปลอดภัย
async function safeQuery(sql, params = [], label = '') {
  try {
    const [rows] = await db.query(sql, params);
    return rows;
  } catch (e) {
    console.warn('[employee/options] skip', label || sql, e.code || e.message);
    return [];
  }
}

/** ดึงรายการทั้งหมด */
async function getAll() {
  const sql = `
    SELECT *
    FROM employees
    WHERE COALESCE(is_status, 1) <> 99
      AND employee_id != 1
    ORDER BY CAST(employee_code AS UNSIGNED) ASC;
  `;
  const [rows] = await db.query(sql);
  return rows;
}

/** รหัสพนักงานล่าสุดจาก employee_code */
async function getLastEmployeeCode() {
  const sql = `
    SELECT employee_code
    FROM employees
    WHERE employee_code REGEXP '^[0-9]+$'
    ORDER BY CAST(employee_code AS UNSIGNED) DESC
    LIMIT 1
  `;
  const [rows] = await db.query(sql);
  return rows.length ? rows[0].employee_code : null;
}

/** คำนวณรหัสพนักงานถัดไป */
async function getNextEmployeeCode() {
  const last = await getLastEmployeeCode();
  if (!last) return 100001;
  const lastNum = parseInt(last, 10);
  return Number.isFinite(lastNum) && lastNum >= 100001 ? lastNum + 1 : 100001;
}

/** ===== employee_id: EMPddmmyy + ลำดับ(3) ===== */
function _prefixToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yy = String(d.getFullYear()).slice(-2);
  return `EMP${dd}${mm}${yy}`;
}

async function generateEmployeeIdForToday() {
  const prefix = _prefixToday();
  const sql = `
    SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id, LENGTH(?) + 1, 3) AS UNSIGNED)), 0) AS lastSeq
    FROM employees
    WHERE employee_id LIKE CONCAT(?, '%')
      AND employee_id REGEXP CONCAT('^', ?, '[0-9]{3}$')
  `;
  const [rows] = await db.query(sql, [prefix, prefix, prefix]);
  const last = Number(rows[0]?.lastSeq || 0);
  const next = last + 1;
  const seq = String(next).padStart(3, '0').slice(-3);
  return `${prefix}${seq}`;
}

/** utility: ดึง code จากตารางอื่น โดยใช้ “ชื่อ” */
async function getCodeByName({ table, nameColumn, codeColumn, value }) {
  if (!value) return null;
  const sql = `
    SELECT ${codeColumn} AS code
    FROM ${table}
    WHERE ${nameColumn} = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [value]);
  return rows.length ? rows[0].code : null;
}

/** options สำหรับ dropdown */
async function getOptions() {
  const [
    titlename, companies, branches, departments,
    worksites, positions, employeeTypes, workingStatuses, resignReasons,
    genders, subdistricts, districts, provinces, postcodes,
    commuteDistances, residenceTypes, ssoHospitals,
    nationalities, ethnicities, religions, bloodgroups, maritalStatuses, militaryStatuses,
    educations, educationInstitutions, recruitmentSources, disabledtypes,
  ] = await Promise.all([
    safeQuery(`SELECT G_NAME AS name_th, G_NAME_EN AS name_en FROM tb_titlename ORDER BY G_ID`, [], 'tb_titlename'),
    safeQuery(`SELECT company_code, company_name_th FROM tb_company ORDER BY company_name_th`, [], 'tb_company'),
    safeQuery(`SELECT G_CODE AS branch_code, G_NAME AS branch, company_code FROM tb_branch ORDER BY G_CODE`, [], 'tb_branch'),
    safeQuery(`SELECT G_CODE AS dep_code, G_NAME AS department, branch_code FROM tb_department WHERE G_NAME IS NOT NULL AND TRIM(G_NAME) <> '' ORDER BY G_CODE`, [], 'tb_department'),
    safeQuery(`SELECT G_NAME AS worksites FROM tb_worksites ORDER BY G_CODE`, [], 'tb_worksites'),
    safeQuery(`SELECT G_NAME AS position, department_code FROM tb_position WHERE G_NAME IS NOT NULL AND TRIM(G_NAME) <> '' ORDER BY G_CODE`, [], 'tb_position'),
    safeQuery(`SELECT G_NAME AS employee_type FROM tb_employee_type ORDER BY G_CODE`, [], 'tb_employee_type'),
    safeQuery(`SELECT G_NAME AS working_status FROM tb_working_status ORDER BY G_CODE`, [], 'tb_working_status'),
    safeQuery(`SELECT G_NAME AS resign_reason FROM tb_resign_reason ORDER BY G_CODE`, [], 'tb_resign_reason'),
    safeQuery(`SELECT G_NAME AS gender FROM tb_gender ORDER BY G_CODE`, [], 'tb_gender'),
    safeQuery(`SELECT name_th AS subdistrict FROM sub_districts ORDER BY name_th`, [], 'sub_districts'),
    safeQuery(`SELECT name_th AS district   FROM districts      ORDER BY name_th`, [], 'districts'),
    safeQuery(`SELECT name_th AS province    FROM provinces    ORDER BY name_th`, [], 'provinces'),
    safeQuery(`SELECT zip_code AS postcode    FROM sub_districts    ORDER BY zip_code`, [], 'sub_districts'),
    safeQuery(`SELECT G_NAME AS commute_distance FROM tb_commute_distance ORDER BY G_CODE`, [], 'tb_commute_distance'),
    safeQuery(`SELECT G_NAME AS residence_type   FROM tb_residence_type   ORDER BY G_CODE`, [], 'tb_residence_type'),
    safeQuery(`SELECT G_NAME AS sso_hospital FROM tb_sso_hospital ORDER BY G_CODE`, [], 'tb_sso_hospital'),
    safeQuery(`SELECT G_NAME AS nationality FROM tb_nationality ORDER BY G_CODE`, [], 'tb_nationality'),
    safeQuery(`SELECT G_NAME AS ethnicity   FROM tb_ethnicity   ORDER BY G_CODE`, [], 'tb_ethnicity'),
    safeQuery(`SELECT G_NAME AS religion    FROM tb_religion    ORDER BY G_CODE`, [], 'tb_religion'),
    safeQuery(`SELECT G_NAME AS blood_group    FROM tb_blood_group    ORDER BY G_CODE`, [], 'tb_blood_group'),
    safeQuery(`SELECT G_NAME AS marital_status  FROM tb_marital_status  ORDER BY G_CODE`, [], 'tb_marital_status'),
    safeQuery(`SELECT G_NAME AS military_status FROM tb_military_status ORDER BY G_CODE`, [], 'tb_military_status'),
    safeQuery(`SELECT G_NAME AS education  FROM tb_education  ORDER BY G_CODE`, [], 'tb_education'),
    safeQuery(`SELECT G_NAME AS education_institution FROM tb_education_institution ORDER BY G_CODE`, [], 'tb_education_institution'),
    safeQuery(`SELECT G_NAME AS recruitment_source FROM tb_recruitment_source ORDER BY G_CODE`, [], 'tb_recruitment_source'),
    safeQuery(`SELECT G_NAME AS disabled_type FROM tb_disabled_type WHERE G_NAME IS NOT NULL AND TRIM(G_NAME) <> '' ORDER BY G_CODE`, [], 'tb_disabled_type'),
  ]);

  return {
    titlename, companies, branches, departments,
    worksites, positions, employeeTypes, workingStatuses, resignReasons,
    genders, subdistricts, districts, provinces, postcodes,
    commuteDistances, residenceTypes, ssoHospitals,
    nationalities, ethnicities, religions, bloodgroups, maritalStatuses, militaryStatuses,
    educations, educationInstitutions, recruitmentSources, disabledtypes,
  };
}

/** Province/District สำหรับ “ออกให้ที่ …” */
async function getIssuedProvinces() {
  return await safeQuery(`SELECT id, name_th FROM provinces ORDER BY name_th`, [], 'provinces');
}
async function getIssuedDistricts(provinceId) {
  if (!provinceId) return [];
  return await safeQuery(
    `SELECT id, name_th FROM districts WHERE province_id = ? ORDER BY name_th`,
    [provinceId],
    'districts.by_province'
  );
}

/** ตรวจซ้ำ employee_code */
async function isEmployeeCodeTaken(code) {
  if (!code) return false;
  const [rows] = await db.query(
    'SELECT 1 FROM employees WHERE employee_code = ? LIMIT 1',
    [String(code)]
  );
  return rows.length > 0;
}

/** ตรวจซ้ำ employee_id (PK/UNIQUE) */
async function isEmployeeIdTaken(id) {
  if (!id) return false;
  const [rows] = await db.query(
    'SELECT 1 FROM employees WHERE employee_id = ? LIMIT 1',
    [String(id)]
  );
  return rows.length > 0;
}

/* ========================= INSERT ========================= */
const EMP_BASE_FIELDS = [
  'employee_id', 'employee_code',
  'titlename_th', 'firstname_th', 'lastname_th', 'nickname_th',
  'titlename_en', 'firstname_en', 'lastname_en', 'nickname_en',
  'company_code', 'company', 'branch_code', 'branch', 'dep_code', 'department',
  'worksites', 'position', 'employee_type', 'working_status',
  'sign_date', 'resign_date', 'resign_reason', 'person_remark', 'disabled_type',
  'disabled_person', 'general_remark', 'permission_status',
  'created_at', 'created_by', 'updated_at', 'updated_by',
];

const EMP_PROFILE_FIELDS = [
  'employee_id', 'employee_code',
  'foreign_workers', 'jobapp_number', 'job_date', 'salary',
  'id_card', 'iris_id', 'foreign_id', 'passport_id', 'issued_district', 'issued_province', 'idcard_sdate', 'idcard_edate',
  'reg_addr_no', 'village_name', 'village_no', 'alley', 'junction', 'road',
  'subdistrict', 'district', 'province', 'postcode', 'phone_number',
  'curr_addr_no', 'village_name1', 'village_no1', 'alley1', 'junction1', 'road1',
  'subdistrict1', 'district1', 'province1', 'postcode1', 'phone_number1',
  'commute_distance', 'residence_type',
  'sso_registered', 'sso_hospital', 'sso_number', 'sso_numbe',
  'sso_received_date', 'sso_card_lost', 'sso_card_expired',
  'sso_hospital_alt1', 'sso_hospital_alt2', 'monthly_financial_burden',
  'gender', 'birthdate', 'age', 'birthplace', 'weight_kg', 'height_cm',
  'nationality', 'ethnicity', 'religion', 'blood_group', 'drug_allergy',
  'chronic_disease', 'marital_status',
  'military_status', 'military_remark', 'education', 'education_institution',
  'major', 'grad_year_be',
  'has_car_license', 'car_license_number',
  'has_motorcycle_license', 'motorcycle_license_number',
  'formerly_employed', 'formerly_employed_detail', 'hobbies',
  'drug_allergy_info', 'treatment_info', 'doctor_advice', 'general_notes', 'recruitment_source',
  'father_name', 'father_occupation', 'father_address',
  'mother_name', 'mother_occupation', 'mother_address',
  'siblings_count', 'birth_order',
  'spouse_name', 'spouse_occupation', 'spouse_income', 'spouse_workplace', 'spouse_phone',
  'children_total_count', 'children_count_pre_school', 'children_count_studying', 'children_count_graduated',
  'has_guarantor', 'can_type', 'typing_speed_th', 'typing_speed_en', 'computer_skills', 'guarantor_name', 'employee_img',
];

const EMP_BOOLEAN_FIELDS = new Set([
  'disabled_person', 'foreign_workers', 'sso_registered', 'sso_card_lost', 'sso_card_expired',
  'has_car_license', 'has_motorcycle_license', 'formerly_employed', 'has_guarantor', 'can_type',
]);

// ✅ ฟิลด์ที่ใช้เก็บลง employees_log (ตามที่ระบุ)
const EMP_LOG_FIELDS = [
  'employee_id',
  'employee_code',
  'company',
  'branch',
  'department',
  'worksites',
  'position',
  'employee_type',
  'working_status',
  'person_remark',
  'resign_reason',
  'resign_date',
  'id_card',
  'iris_id',
  'foreign_id',
  'passport_id',
  'titlename_th',
  'firstname_th',
  'lastname_th',
  'titlename_en',
  'firstname_en',
  'lastname_en',
  'marital_status',
  'military_status',
  'education',
  'education_institution',
  'major',
  'grad_year_be',
  'updated_at',
  'updated_by',
  'created_at',
  'created_by',
];

// ✅ ฟังก์ชัน insert log โดยรับ payload ที่มีเฉพาะฟิลด์ที่เปลี่ยน
// ✅ ฟังก์ชัน insert log ที่ปรับปรุง logic ตามโจทย์
async function insertEmployeeLog(logPayload) {
  const columns = await getEmployeeLogColumns();
  const fields = EMP_LOG_FIELDS.filter(f => columns.has(f));

  // ต้องมี employee_id
  if (!logPayload.employee_id) {
    throw new Error('employees_log insert require employee_id');
  }

  // 🔹 ตรวจสอบว่าเป็นโหมด Create หรือ Update
  // ถ้ามี updated_by ส่งมา ถือว่าเป็น Update
  const isUpdate = !!logPayload.updated_by;
  // ถ้ามี created_by แต่ไม่มี updated_by ถือว่าเป็น Create
  const isCreate = !!logPayload.created_by && !isUpdate;

  // สร้าง SQL Values
  // - ถ้า Create: created_at = NOW(), updated_at = NULL (?)
  // - ถ้า Update: updated_at = NOW()
  const valuesSql = fields.map(f => {
    if (f === 'created_at' && isCreate) return 'NOW()';
    if (f === 'updated_at' && isUpdate) return 'NOW()';
    return '?';
  }).join(', ');

  const sql = `
    INSERT INTO employees_log (${fields.map(f => `\`${f}\``).join(', ')})
    VALUES (${valuesSql})
  `;

  // เตรียม Params (ตัด field ที่ใช้ NOW() ออกไป)
  const params = [];
  fields.forEach(f => {
    if (f === 'created_at' && isCreate) return; // ใช้ NOW() ใน SQL แล้ว
    if (f === 'updated_at' && isUpdate) return; // ใช้ NOW() ใน SQL แล้ว

    const v = logPayload[f];
    // แปลง undefined/ค่าว่าง ให้เป็น NULL (ยกเว้น 0 หรือ false)
    if (v === undefined || v === '') {
      params.push(null);
    } else {
      params.push(v);
    }
  });

  await db.query(sql, params);
}

// รายชื่อจังหวัดสำหรับข้อมูลที่อยู่
async function getAddressProvinces() {
  return await safeQuery(`SELECT id, name_th FROM provinces ORDER BY name_th`, [], 'provinces');
}
async function getAddressDistricts(provinceId) {
  if (!provinceId) return [];
  return await safeQuery(
    `SELECT id, name_th FROM districts WHERE province_id = ? ORDER BY name_th`,
    [provinceId],
    'districts.by_province'
  );
}
async function getAddressSubDistricts(districtId) {
  if (!districtId) return [];
  return await safeQuery(
    `SELECT id, name_th, zip_code FROM sub_districts WHERE district_id = ? ORDER BY name_th`,
    [districtId],
    'sub_districts.by_district'
  );
}

// --- อัปเดตรูปภาพพนักงาน ---
async function updateEmployeeImage(employee_id, imgPath) {
  const sql = `UPDATE employees_profile SET employee_img = ? WHERE employee_id = ? LIMIT 1`;
  const [result] = await db.query(sql, [imgPath, employee_id]);
  return result.affectedRows > 0;
}

// เพิ่มข้อมูลพื้นฐานลงตาราง employees
async function createBase(payload) {
  const columns = await getEmployeeColumns();
  const fields = EMP_BASE_FIELDS.filter(f => columns.has(f));

  // สร้าง Placeholders: เฉพาะ created_at ที่ใช้ NOW() ส่วน updated_at ใช้ ? ปกติ (ซึ่งค่าจะเป็น NULL)
  const placeholders = fields.map(f => (f === 'created_at' ? 'NOW()' : '?')).join(', ');

  const sql = `
    INSERT INTO employees (${fields.map(f => `\`${f}\``).join(', ')})
    VALUES (${placeholders})
  `;

  const params = fields
    .filter(f => f !== 'created_at') // ตัด created_at ออกเพราะใช้ NOW()
    .map((f) => {
      // 🔹 บังคับให้ updated_at และ updated_by เป็น NULL ตอนสร้าง
      if (f === 'updated_at' || f === 'updated_by') return null;

      const v = payload[f];
      if (EMP_BOOLEAN_FIELDS.has(f)) return (v === true || v === 1 || v === '1') ? 1 : 0;
      return (v === '' || v === undefined) ? null : v;
    });

  await db.query(sql, params);
  return { ...payload };
}

// เพิ่มข้อมูลโปรไฟล์ลงตาราง employees_profile
async function createProfile(payload) {
  const columns = await getEmployeeProfileColumns();
  const fields = EMP_PROFILE_FIELDS.filter(f => columns.has(f));
  if (!fields.includes('employee_id') || !fields.includes('employee_code')) {
    throw Object.assign(new Error('employees_profile missing employee_id/employee_code'), { status: 500 });
  }
  const sql = `
    INSERT INTO employees_profile (${fields.map(f => `\`${f}\``).join(', ')})
    VALUES (${fields.map(() => '?').join(', ')})
  `;
  const params = fields.map((f) => {
    const v = payload[f];
    if (EMP_BOOLEAN_FIELDS.has(f)) return (v === true || v === 1 || v === '1') ? 1 : 0;
    return (v === '' || v === undefined) ? null : v;
  });
  await db.query(sql, params);
  return { ...payload };
}

// ดึงชื่อคอลัมน์ของตาราง employees_workhistory
async function getEmployeeWorkhistoryColumns() {
  if (_empWorkhistoryColumnsCache) return _empWorkhistoryColumnsCache;
  const [rows] = await db.query('SHOW COLUMNS FROM employees_workhistory');
  _empWorkhistoryColumnsCache = new Set(rows.map(r => r.Field));
  return _empWorkhistoryColumnsCache;
}

// ดึงชื่อคอลัมน์ของตาราง employees_relatives
async function getEmployeeRelativesColumns() {
  if (_empRelativesColumnsCache) return _empRelativesColumnsCache;
  const [rows] = await db.query('SHOW COLUMNS FROM employees_relatives');
  _empRelativesColumnsCache = new Set(rows.map(r => r.Field));
  return _empRelativesColumnsCache;
}

const EMP_WORKHISTORY_FIELDS = ['employee_id', 'employee_code'];
const EMP_RELATIVES_FIELDS = ['employee_id', 'employee_code'];

// สร้างแถวขั้นต่ำใน employees_workhistory
async function createWorkHistoryMinimal(payload) {
  const columns = await getEmployeeWorkhistoryColumns();
  const fields = EMP_WORKHISTORY_FIELDS.filter(f => columns.has(f));
  if (!fields.includes('employee_id') || !fields.includes('employee_code')) {
    throw Object.assign(new Error('employees_workhistory missing employee_id/employee_code'), { status: 500 });
  }
  const sql = `
    INSERT INTO employees_workhistory (${fields.map(f => `\`${f}\``).join(', ')})
    VALUES (${fields.map(() => '?').join(', ')})
  `;
  const params = fields.map(f => (payload[f] ?? null));
  await db.query(sql, params);
  return { ...payload };
}

// สร้างแถวขั้นต่ำใน employees_relatives
async function createRelativesMinimal(payload) {
  const columns = await getEmployeeRelativesColumns();
  const fields = EMP_RELATIVES_FIELDS.filter(f => columns.has(f));
  if (!fields.includes('employee_id') || !fields.includes('employee_code')) {
    throw Object.assign(new Error('employees_relatives missing employee_id/employee_code'), { status: 500 });
  }
  const sql = `
    INSERT INTO employees_relatives (${fields.map(f => `\`${f}\``).join(', ')})
    VALUES (${fields.map(() => '?').join(', ')})
  `;
  const params = fields.map(f => (payload[f] ?? null));
  await db.query(sql, params);
  return { ...payload };
}

// ดึงรายละเอียดพนักงานแบบ join
async function getDetailById(employee_id) {
  const sql = `
    SELECT e.*, p.*
    FROM employees e
    LEFT JOIN employees_profile p ON p.employee_id = e.employee_id
    WHERE e.employee_id = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [employee_id]);
  return rows[0] || null;
}
/* ====================== /INSERT =========================== */

// ======== UPDATE (transaction) ========

async function getBaseById(employee_id) {
  const [rows] = await db.query('SELECT employee_id, employee_code FROM employees WHERE employee_id = ? LIMIT 1', [employee_id]);
  return rows[0] || null;
}

// อัปเดตฟิลด์ในตาราง employees
async function updateBase(conn, employee_id, payload) {
  const columns = await getEmployeeColumns();
  const allow = new Set(EMP_BASE_FIELDS.filter(f => f !== 'employee_id' && f !== 'employee_code'));
  const updatable = [...allow].filter(f => columns.has(f));

  const sets = [];
  const params = [];

  updatable.forEach(f => {
    if (f === 'updated_at') return;
    if (payload[f] === undefined) return;
    sets.push(`\`${f}\` = ?`);
    const v = EMP_BOOLEAN_FIELDS.has(f)
      ? ((payload[f] === true || payload[f] === 1 || payload[f] === '1') ? 1 : 0)
      : (payload[f] === '' ? null : payload[f]);
    params.push(v);
  });

  if (columns.has('updated_at')) {
    sets.push('`updated_at` = NOW()');
  }

  if (!sets.length) return;

  await conn.query(
    `UPDATE employees SET ${sets.join(', ')} WHERE employee_id = ? LIMIT 1`,
    [...params, employee_id]
  );
}

// อัปเดตฟิลด์ในตาราง employees_profile
async function updateProfile(conn, employee_id, payload) {
  const columns = await getEmployeeProfileColumns();
  const allow = new Set(EMP_PROFILE_FIELDS.filter(f => f !== 'employee_id' && f !== 'employee_code'));
  const fields = [...allow].filter(f => columns.has(f) && payload[f] !== undefined);

  if (!fields.length) return;
  const sets = fields.map(f => `\`${f}\` = ?`).join(', ');
  const params = fields.map(f => (
    EMP_BOOLEAN_FIELDS.has(f)
      ? ((payload[f] === true || payload[f] === 1 || payload[f] === '1') ? 1 : 0)
      : (payload[f] === '' ? null : payload[f])
  ));
  await conn.query(`UPDATE employees_profile SET ${sets} WHERE employee_id = ? LIMIT 1`, [...params, employee_id]);
}

// กระจายการอัปเดต employee_code
async function updateEmployeeCodeEverywhere(conn, employee_id, newCode) {
  const code = String(newCode || '').trim();
  if (!code) return;

  await conn.query(`UPDATE employees SET employee_code = ? WHERE employee_id = ? LIMIT 1`, [code, employee_id]);
  await conn.query(`UPDATE employees_profile SET employee_code = ? WHERE employee_id = ? LIMIT 1`, [code, employee_id]);

  try { await conn.query(`UPDATE employees_workhistory SET employee_code = ? WHERE employee_id = ?`, [code, employee_id]); } catch { }
  try { await conn.query(`UPDATE employees_relatives SET employee_code = ? WHERE employee_id = ?`, [code, employee_id]); } catch { }
}

/** อัปเดตข้อมูลทั้งหมดแบบ transaction */
async function updateAll(employee_id, payload) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await updateBase(conn, employee_id, payload);
    await updateProfile(conn, employee_id, payload);

    if (payload.__updateCode === true && payload.employee_code) {
      await updateEmployeeCodeEverywhere(conn, employee_id, payload.employee_code);
    }

    await conn.commit();
  } catch (e) {
    try { await conn.rollback(); } catch { }
    throw e;
  } finally {
    conn.release();
  }
}

// ดึงรายละเอียดพนักงานด้วย employee_code
async function getDetailByCode(employee_code) {
  const sql = `
    SELECT e.*, p.*
    FROM employees e
    LEFT JOIN employees_profile p ON p.employee_id = e.employee_id
    WHERE e.employee_code = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [employee_code]);
  return rows[0] || null;
}

// ดึงชื่อเอกสาร
async function getDocCode(codeKey) {
  try {
    const sql = `SELECT G_NAME FROM tb_doccode LIMIT 1`;
    const [rows] = await db.query(sql, [codeKey]);
    return rows.length ? rows[0].G_NAME : null;
  } catch (e) {
    console.error(`[PDF Error] Could not query tb_doccode for G_CODE=${codeKey}: ${e.message}`);
    return null;
  }
}

// Soft delete
async function softDelete(employee_id, deletedBy) {
  const sql = `
    UPDATE employees
    SET is_status = 99,
        deleted_at = NOW(),
        deleted_by = ?
    WHERE employee_id = ?
    LIMIT 1
  `;
  const [rs] = await db.query(sql, [deletedBy, employee_id]);
  return rs.affectedRows > 0;
}

// ตรวจสอบ username
async function hasUsername(employee_id) {
  const [rows] = await db.query(
    'SELECT username FROM employees WHERE employee_id = ? LIMIT 1',
    [employee_id]
  );
  const u = (rows?.[0]?.username ?? '').trim();
  return !!u;
}

module.exports = {
  getAll,
  getLastEmployeeCode,
  getNextEmployeeCode,
  generateEmployeeIdForToday,
  getCodeByName,
  getOptions,
  getIssuedProvinces,
  getIssuedDistricts,
  isEmployeeCodeTaken,
  isEmployeeIdTaken,
  createBase,
  createProfile,
  getAddressProvinces,
  getAddressDistricts,
  getAddressSubDistricts,
  updateEmployeeImage,
  createWorkHistoryMinimal,
  createRelativesMinimal,
  getDetailById,
  getBaseById,
  updateAll,
  getDetailByCode,
  getDocCode,
  softDelete,
  hasUsername,
  insertEmployeeLog, // ✅ ส่งออกฟังก์ชันนี้
};