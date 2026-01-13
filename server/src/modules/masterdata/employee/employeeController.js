// .src/modules/masterdata/employee/employeeController.js
'use strict';
const model = require('./employeeModel');
const pdf = require('./pdf');

// ... (GET functions: getAll, getNextCode, checkCode, getOptions, getIssued... คงเดิม)

async function getAll(_req, res, next) {
  try { res.json({ success: true, data: await model.getAll() }); }
  catch (err) { next(err); }
}

async function getNextCode(_req, res, next) {
  try {
    res.json({
      success: true,
      next_code: await model.getNextEmployeeCode(),
      last_code: await model.getLastEmployeeCode()
    });
  } catch (err) { next(err); }
}

async function checkCode(req, res, next) {
  try {
    const code = String(req.query.employee_code || '').trim();
    if (!code) return res.json({ success: true, exists: false });
    res.json({ success: true, exists: await model.isEmployeeCodeTaken(code) });
  } catch (err) { next(err); }
}

async function getOptions(_req, res, next) {
  try { res.json({ success: true, data: await model.getOptions() }); }
  catch (err) { next(err); }
}

async function getIssuedProvinces(_req, res, next) {
  try { res.json({ success: true, data: await model.getIssuedProvinces() }); }
  catch (err) { next(err); }
}

async function getIssuedDistricts(req, res, next) {
  try {
    const pid = Number(req.query.province_id);
    if (!pid) return res.status(400).json({ success: false, message: 'province_id is required' });
    res.json({ success: true, data: await model.getIssuedDistricts(pid) });
  } catch (err) { next(err); }
}

async function hydrateCodesFromNames(payload) {
  const out = { ...payload };
  if (!out.company_code && out.company) {
    out.company_code = await model.getCodeByName({
      table: 'tb_company', nameColumn: 'company_name_th', codeColumn: 'company_code', value: out.company.trim()
    });
    if (!out.company_code) { const e = new Error('ไม่พบบริษัทตามชื่อที่ส่งมา'); e.status = 400; throw e; }
  }
  if (!out.branch_code && out.branch) {
    out.branch_code = await model.getCodeByName({
      table: 'tb_branch', nameColumn: 'G_NAME', codeColumn: 'G_CODE', value: out.branch.trim()
    });
    if (!out.branch_code) { const e = new Error('ไม่พบสาขาตามชื่อที่ส่งมา'); e.status = 400; throw e; }
  }
  if (!out.dep_code && out.department) {
    out.dep_code = await model.getCodeByName({
      table: 'tb_department', nameColumn: 'G_NAME', codeColumn: 'G_CODE', value: out.department.trim()
    });
    if (!out.dep_code) { const e = new Error('ไม่พบแผนกตามชื่อที่ส่งมา'); e.status = 400; throw e; }
  }
  return out;
}

// ... (create function คงเดิม)
async function create(req, res, next) {
  try {
    const body = { ...req.body };

    if (await model.isEmployeeCodeTaken(String(body.employee_code || '').trim())) {
      const e = new Error('รหัสพนักงานนี้ถูกใช้งานแล้ว'); e.status = 409; throw e;
    }

    const createdBy = (req.user && (req.user.employee_id || req.user.id || req.user.user_id)) || null;
    const payload = await hydrateCodesFromNames({ ...body, created_by: createdBy });

    const MAX_RETRY = 8;
    let createdBase = false;
    for (let i = 0; i < MAX_RETRY && !createdBase; i++) {
      const id = await model.generateEmployeeIdForToday();
      payload.employee_id = id;
      try {
        await model.createBase(payload);
        createdBase = true;
      } catch (e) {
        if (e?.code === 'ER_DUP_ENTRY') {
          await new Promise(r => setTimeout(r, 30));
          payload.employee_id = undefined;
          continue;
        }
        throw e;
      }
    }
    if (!createdBase) {
      const e = new Error('ไม่สามารถสร้าง employee_id ได้'); e.status = 500; throw e;
    }

    await model.createProfile({ ...payload, employee_id: payload.employee_id, employee_code: payload.employee_code });

    try {
      await model.createWorkHistoryMinimal({ employee_id: payload.employee_id, employee_code: payload.employee_code });
    } catch (e) {
      console.warn('[employee:create] skip seed employees_workhistory:', e.message);
    }
    try {
      await model.createRelativesMinimal({ employee_id: payload.employee_id, employee_code: payload.employee_code });
    } catch (e) {
      console.warn('[employee:create] skip seed employees_relatives:', e.message);
    }

    // --- ส่วนที่: บันทึก Log การสร้าง ---
    try {
      const logPayload = {
        ...payload,
        employee_id: payload.employee_id,
        created_by: createdBy, // ✅ มี created_by
        // updated_by: createdBy, // ✅ สำคัญ: ต้อง Comment ไว้ เพื่อให้ created_at=NOW() และ updated_at=NULL
      };
      await model.insertEmployeeLog(logPayload);
    } catch (e) {
      console.warn('[employee:create] insertEmployeeLog failed:', e.message);
      // ไม่ throw error เพื่อให้ process การสร้างพนักงานหลักยังถือว่าสำเร็จ
    }

    const io = req.app.get('io'); if (io) io.emit('employee:upsert', { ...payload });
    res.status(201).json({ success: true, data: { ...payload } });
  } catch (err) { next(err); }
}

async function getAddressProvinces(_req, res, next) {
  try { res.json({ success: true, data: await model.getAddressProvinces() }); }
  catch (err) { next(err); }
}
async function getAddressDistricts(req, res, next) {
  try {
    const pid = Number(req.query.province_id);
    if (!pid) return res.status(400).json({ success: false, message: 'province_id is required' });
    res.json({ success: true, data: await model.getAddressDistricts(pid) });
  } catch (err) { next(err); }
}
async function getAddressSubDistricts(req, res, next) {
  try {
    const did = Number(req.query.district_id);
    if (!did) return res.status(400).json({ success: false, message: 'district_id is required' });
    res.json({ success: true, data: await model.getAddressSubDistricts(did) });
  } catch (err) { next(err); }
}

async function uploadImage(req, res, next) {
  try {
    const employee_id = req.params.employee_id;
    if (!req.file) return res.status(400).json({ success: false, message: 'image is required' });
    const publicPath = `/img/employee/${req.file.filename}`;
    await model.updateEmployeeImage(employee_id, publicPath);
    const io = req.app.get('io'); if (io) io.emit('employee:upsert', { employee_id, employee_img: publicPath });
    res.json({ success: true, path: publicPath });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const id = req.params.employee_id;
    const row = await model.getDetailById(id);
    if (!row) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลพนักงาน' });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
}

// ✅ UPDATE: ปรับปรุงเงื่อนไขการเก็บ Log
async function update(req, res, next) {
  try {
    const employee_id = req.params.employee_id;
    const current = await model.getBaseById(employee_id);
    if (!current) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลพนักงาน' });

    // 1. ดึงข้อมูลก่อนอัปเดต (เพื่อใช้เทียบหาการเปลี่ยนแปลง)
    const beforeRow = await model.getDetailById(employee_id);

    const payload = { ...req.body };
    const hydrated = await hydrateCodesFromNames(payload);

    if (hydrated.permission_status === true) hydrated.permission_status = 'activate';

    const newCode = String(hydrated.employee_code || '').trim();
    const oldCode = String(current.employee_code || '').trim();
    if (newCode && newCode !== oldCode) {
      if (await model.isEmployeeCodeTaken(newCode)) {
        const e = new Error('รหัสพนักงานนี้ถูกใช้งานแล้ว'); e.status = 409; throw e;
      }
      hydrated.__updateCode = true;
    }

    const updatedBy = (req.user && (req.user.employee_id || req.user.id || req.user.user_id)) || null;
    hydrated.updated_by = updatedBy;

    // 2. กำหนดฟิลด์ที่ต้องการ Track ลง Log
    const LOG_FIELDS = [
      'employee_code', 'company', 'branch', 'department', 'worksites', 'position',
      'employee_type', 'working_status', 'person_remark', 'resign_reason', 'resign_date',
      'iris_id', 'foreign_id', 'passport_id',
      'titlename_th', 'firstname_th', 'lastname_th',
      'titlename_en', 'firstname_en', 'lastname_en',
      'marital_status', 'military_status',
      'education', 'education_institution', 'major', 'grad_year_be',
    ];

    // ฟังก์ชันช่วย Normalize ค่าเพื่อเปรียบเทียบ (กันเรื่อง Date Object vs String)
    const normalize = (val) => {
      if (val === null || val === undefined) return '';
      if (val instanceof Date) {
        // แปลง Date Object เป็น YYYY-MM-DD เพื่อเทียบกับ String จาก FE
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      // ถ้าเป็น String วันที่ (เช่น '2025-10-27T00:00:00.000Z') ให้ตัดเอาแค่วันที่
      const s = String(val);
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
      return s.trim();
    };

    // 3. เตรียมข้อมูล Log: เก็บเฉพาะ field ที่เปลี่ยนแปลง
    let hasChanges = false;
    const logPayload = {
      employee_id: employee_id,
      updated_by: updatedBy, // ✅ มี updated_by -> Model จะรู้ว่าเป็น Update และใส่ updated_at=NOW()
    };

    if (beforeRow) {
      LOG_FIELDS.forEach(field => {
        // ถ้า payload ไม่ได้ส่ง key นี้มา (undefined) ข้ามไปเลย (ถือว่าฟอร์มไม่ได้แก้ส่วนนี้)
        if (hydrated[field] === undefined) return;

        const oldVal = normalize(beforeRow[field]);
        const newVal = normalize(hydrated[field]);

        if (oldVal !== newVal) {
          // ถ้าค่าไม่เหมือนเดิม -> บันทึกค่าใหม่ลง logPayload
          logPayload[field] = hydrated[field];
          hasChanges = true;
        }
        // ถ้าเท่าเดิม -> ไม่ทำอะไร (field นี้ใน logPayload จะเป็น undefined -> Model จะ insert เป็น NULL)
      });
    }

    // 4. อัปเดตข้อมูลจริงลง employees/profile
    await model.updateAll(employee_id, hydrated);

    // 5. ถ้าตรวจพบการเปลี่ยนแปลง -> Insert ลง employees_log
    if (hasChanges) {
      try {
        await model.insertEmployeeLog(logPayload);
      } catch (e) {
        console.warn('[employee:update] insertEmployeeLog failed:', e.message);
      }
    }

    const row = await model.getDetailById(employee_id);
    const io = req.app.get('io'); if (io) io.emit('employee:upsert', { employee_id, employee_code: row.employee_code });

    res.json({ success: true, data: row });
  } catch (err) { next(err); }
}

async function printPdf(req, res, next) {
  try {
    const id = req.params.employee_id;
    const row = await model.getDetailById(id);
    if (!row) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลพนักงาน' });

    const docCodeString = await model.getDocCode('APC/F-HR-10');
    row.docCode = docCodeString;

    const buffer = await pdf.renderEmployeeForm(row);
    const filename = `employee-${row.employee_code || id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  } catch (err) { next(err); }
}

async function printPdfByCode(req, res, next) {
  try {
    const code = req.params.employee_code;
    const row = await model.getDetailByCode(code);
    if (!row) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลพนักงาน' });

    const docCodeString = await model.getDocCode('APC/F-HR-10');
    row.docCode = docCodeString;

    const buffer = await pdf.renderEmployeeForm(row);
    const filename = `employee-${row.employee_code}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  } catch (err) { next(err); }
}

async function softDelete(req, res, next) {
  try {
    const employee_id = req.params.employee_id;
    const current = await model.getBaseById(employee_id);
    if (!current) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลพนักงาน' });
    }

    const hasUsername = await model.hasUsername(employee_id);
    if (hasUsername) {
      return res.status(400).json({
        success: false,
        code: 'HAS_USERNAME',
        message: 'กรุณาลบผู้ใช้งาน ในหน้าเมนู กำหนดสิทธิผู้ใช้งาน ก่อน',
      });
    }

    const deletedBy = (req.user && (req.user.employee_id || req.user.id || req.user.user_id)) || null;

    await model.softDelete(employee_id, deletedBy);

    const io = req.app.get('io');
    if (io) io.emit('employee:upsert', { employee_id, is_status: 99, deleted_by: deletedBy });

    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = {
  getAll,
  getNextCode,
  checkCode,
  getOptions,
  getIssuedProvinces,
  getIssuedDistricts,
  create,
  getAddressProvinces,
  getAddressDistricts,
  getAddressSubDistricts,
  uploadImage,
  getOne,
  update,
  printPdf,
  printPdfByCode,
  softDelete,
};