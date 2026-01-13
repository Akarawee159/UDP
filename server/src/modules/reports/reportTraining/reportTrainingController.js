'use strict';

const model = require('./reportTrainingModel');
const { reportTraining } = require('./pdf');

const isYMD = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
function normStr(v) {
  const s = (v ?? '').toString().trim();
  return s.length ? s : null;
}

async function optionsEmployees(req, res, next) {
  try {
    const empStatus = normStr(req.query.empStatus); // current | resigned | null
    const q = normStr(req.query.q);
    const rows = await model.searchEmployees({ empStatus, q });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function optionsCourses(req, res, next) {
  try {
    // ✅ ไม่บังคับต้องมีช่วงวันที่แล้ว (ถ้ามีจะกรองตามช่วงวันให้)
    const start = normStr(req.query.start);
    const end = normStr(req.query.end);
    const q = normStr(req.query.q);

    const rows = await model.searchCourses({
      start: isYMD(start) ? start : null,
      end: isYMD(end) ? end : null,
      q,
    });

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function optionsBookingCodes(req, res, next) {
  try {
    // ✅ ไม่บังคับต้องมีช่วงวันที่แล้ว (ถ้ามีจะกรองตามช่วงวันให้)
    const start = normStr(req.query.start);
    const end = normStr(req.query.end);
    const q = normStr(req.query.q);

    const rows = await model.searchBookingCodes({
      start: isYMD(start) ? start : null,
      end: isYMD(end) ? end : null,
      q,
    });

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function personHistory(req, res, next) {
  try {
    const employee_code = normStr(req.query.employee_code);
    if (!employee_code) return res.json({ success: true, data: [] });

    // ✅ ประวัติการอบรม “ทั้งหมด” ของบุคคลนี้
    const rows = await model.getPersonHistory({ employee_code });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function topicMembers(req, res, next) {
  try {
    const booking_code = normStr(req.query.booking_code);
    if (!booking_code) return res.json({ success: true, data: [] });

    // ✅ รายชื่อพนักงาน “ทั้งหมด” ในกลุ่มอบรมนี้
    const rows = await model.getTopicMembers({ booking_code });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function search(req, res, next) {
  try {
    const type = (req.query.type || 'person').toString(); // person | topic

    const start = normStr(req.query.start);
    const end = normStr(req.query.end);

    // person filters
    const empStatus = normStr(req.query.empStatus);
    const employee_code = normStr(req.query.employee_code);
    const courses_code = normStr(req.query.courses_code);

    // topic filter
    const booking_code = normStr(req.query.booking_code);

    const filters = {
      type,
      start: isYMD(start) ? start : null,
      end: isYMD(end) ? end : null,
      empStatus,
      employee_code,
      courses_code,
      booking_code,
    };

    if (type === 'topic') {
      // ✅ ตารางหลักแบบ group ตาม booking_code
      const meta = booking_code ? await model.getBookingMeta({ booking_code }) : null;
      const rows = await model.searchTopicGroups(filters);
      return res.json({ success: true, meta, data: rows });
    }

    // ✅ person: สรุป 1 คน 1 แถว
    const rows = await model.searchPersonSummary(filters);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function personPdf(req, res, next) {
  try {
    const employee_code = normStr(req.query.employee_code);
    if (!employee_code) {
      return res.status(400).json({ success: false, message: 'employee_code is required' });
    }

    // 1) ข้อมูลพนักงาน
    const employee = await model.getEmployeeProfile({ employee_code });

    // 2) ประวัติการอบรมทั้งหมด
    const history = await model.getPersonHistory({ employee_code });

    // 3) เลขที่เอกสารจาก tb_doccode
    const docNo = await model.getDocCodeByForUse({ for_use: 'TrainingReport' });

    const pdfBuffer = await reportTraining({
      employee: employee || { employee_code },
      history: history || [],
      docNo: docNo || ''
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="TrainingReport_${employee_code}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}


module.exports = {
  optionsEmployees,
  optionsCourses,
  optionsBookingCodes,
  personHistory,
  topicMembers,
  search,
  personPdf,
};
