'use strict';

const db = require('../../../config/database');
const dayjs = require('dayjs');
const isBetween = require('dayjs/plugin/isBetween');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
dayjs.extend(isBetween);

/**
 * ✅ Helper: คำนวณสถานะ (1=กำลังอบรม, 2=อบรมแล้ว, 3=รออบรม)
 */
function calculateStatus(start_date, end_date, start_time, end_time) {
  if (!start_date || !end_date) return 3; // Default รออบรม

  const now = dayjs();

  // แปลงวันที่เป็น YYYY-MM-DD
  const sDate = dayjs(start_date).format('YYYY-MM-DD');
  const eDate = dayjs(end_date).format('YYYY-MM-DD');

  // กรณีไม่มีเวลา ให้กำหนดเวลาเริ่มต้นเป็น 00:00:00 และสิ้นสุดเป็น 23:59:59
  const sTime = start_time ? ((start_time.length === 5) ? `${start_time}:00` : start_time) : '00:00:00';
  const eTime = end_time ? ((end_time.length === 5) ? `${end_time}:00` : end_time) : '23:59:59';

  const startFull = dayjs(`${sDate} ${sTime}`);
  const endFull = dayjs(`${eDate} ${eTime}`);

  if (now.isBefore(startFull)) {
    return 3; // รออบรม (ยังไม่ถึงเวลาเริ่ม)
  } else if (now.isAfter(endFull)) {
    return 2; // อบรมแล้ว (เลยเวลาจบ)
  } else {
    return 1; // กำลังอบรม (อยู่ในช่วงเวลา)
  }
}

/**
 * ✅ Helper: อัปเดตสถานะทั้งหมดให้เป็นปัจจุบัน (Auto Update)
 * รับ io เข้ามาเพื่อส่ง Socket Event
 */
async function updateAllStatuses(conn, io) { // <--- รับ io เพิ่ม
  try {
    const [rows] = await conn.query(`
      SELECT booking_courses_id, draft_id, start_date, end_date, start_time, end_time, is_status 
      FROM booking_courses 
      WHERE is_status != 99
    `);

    const updates = [];

    for (const row of rows) {
      const currentStatus = Number(row.is_status);
      const newStatus = calculateStatus(row.start_date, row.end_date, row.start_time, row.end_time);

      if (currentStatus !== newStatus) {
        updates.push({
          id: row.booking_courses_id,
          draft_id: row.draft_id,
          status: newStatus
        });
      }
    }

    if (updates.length > 0) {
      for (const item of updates) {
        // 1. อัปเดต Header
        await conn.query(
          `UPDATE booking_courses SET is_status = ? WHERE booking_courses_id = ?`,
          [item.status, item.id]
        );

        // 2. อัปเดต Detail
        if (item.draft_id) {
          await conn.query(
            `UPDATE booking_detail SET is_status = ? WHERE draft_id = ? AND is_status != 99`,
            [item.status, item.draft_id]
          );
        }

        // --- ✅ NEW: Real-time Notification ---
        // ถ้ามี io ส่งมา ให้ดึงข้อมูลล่าสุดแล้ว emit บอก Frontend
        if (io) {
          const [updatedRow] = await conn.query(
            `SELECT * FROM booking_courses WHERE booking_courses_id = ?`,
            [item.id]
          );

          if (updatedRow.length > 0) {
            // ส่ง Event เดียวกับที่หน้าบ้านรอรับ (trainings:upsert)
            io.emit('trainings:upsert', updatedRow[0]);
          }
        }
        // --------------------------------------
      }
    }
  } catch (err) {
    console.error("Auto update status error:", err);
  }
}

/** ดึงรายการข้อมูลทั้งหมด */
async function getAll(io) { // <--- รับ io เพิ่มจาก Controller
  const conn = await db.getConnection();
  try {
    // ✅ ส่ง io ต่อไปให้ updateAllStatuses
    await updateAllStatuses(conn, io);

    const sql = `SELECT * FROM booking_courses WHERE is_status != 99 ORDER BY start_date DESC`;
    const [rows] = await conn.query(sql);
    return rows;

  } finally {
    conn.release();
  }
}

/** ดึงข้อมูลสำหรับ Dropdown */
async function getCoursesList() {
  const sql = `SELECT G_CODE as code, G_NAME as name FROM tb_courses`;
  const [rows] = await db.query(sql);
  return rows;
}

async function getLocationsList() {
  const sql = `SELECT G_CODE as code, G_NAME as name FROM tb_training_location`;
  const [rows] = await db.query(sql);
  return rows;
}

async function getEmployeeList() {
  const sql = `
    SELECT 
      employee_id,
      employee_code,
      CONCAT_WS(' ', titlename_th, firstname_th, lastname_th) AS fullname_th,
      position,
      department,
      worksites,
      sign_date,
      resign_date
    FROM employees
    WHERE employee_id != 1
      AND (is_status IS NULL OR is_status != 99)         
      AND (resign_date IS NULL)  
  `;
  const [rows] = await db.query(sql);
  return rows;
}


/** คำนวณระยะเวลา (วัน) */
function calculateDurationDate(start, end) {
  if (!start || !end) return '';
  const s = dayjs(start);
  const e = dayjs(end);
  const diff = e.diff(s, 'day') + 1;
  return `${diff} วัน`;
}

/** คำนวณระยะเวลา (เวลา) */
function calculateDurationTime(start, end) {
  if (!start || !end) return '';
  const today = dayjs().format('YYYY-MM-DD');
  const s = dayjs(`${today} ${start}`, 'YYYY-MM-DD HH:mm:ss');
  const e = dayjs(`${today} ${end}`, 'YYYY-MM-DD HH:mm:ss');

  if (!s.isValid() || !e.isValid()) return '';

  const diffMinutes = e.diff(s, 'minute');
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  let result = '';
  if (hours > 0) result += `${hours} ชั่วโมง `;
  if (minutes > 0) result += `${minutes} นาที`;
  return result.trim();
}

/** สร้าง Draft ID */
async function generateDraftId(conn) {
  const sql = `SELECT draft_id FROM booking_courses ORDER BY draft_id DESC LIMIT 1`;
  const [rows] = await conn.query(sql);

  let nextNum = 100000000;
  if (rows.length > 0 && rows[0].draft_id) {
    const lastId = rows[0].draft_id;
    const parts = lastId.split('-');
    if (parts.length > 1) {
      const numPart = parseInt(parts[1]);
      if (!isNaN(numPart)) nextNum = numPart + 1;
    }
  }
  return `D-${nextNum}`;
}

/** สร้าง Booking Code */
async function generateBookingCode(conn) {
  const today = dayjs();
  const thaiYear = (today.year() + 543).toString().slice(-2);
  const dateStr = today.format('DDMM') + thaiYear;
  const prefix = `T-${dateStr}`;

  const sql = `
    SELECT booking_code 
    FROM booking_courses 
    WHERE booking_code LIKE ? 
    ORDER BY booking_code DESC 
    LIMIT 1
  `;
  const [rows] = await conn.query(sql, [`${prefix}%`]);

  let seq = 1;
  if (rows.length > 0 && rows[0].booking_code) {
    const lastCode = rows[0].booking_code;
    const lastSeqStr = lastCode.substring(lastCode.length - 3);
    const lastSeq = parseInt(lastSeqStr);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  const seqStr = String(seq).padStart(3, '0');
  return `${prefix}${seqStr}`;
}

async function getNextId(conn, tableName, idColumn) {
  const sql = `SELECT MAX(${idColumn}) as max_id FROM ${tableName}`;
  const [rows] = await conn.query(sql);
  return (rows[0].max_id || 0) + 1;
}

/** ดึงรายชื่อพนักงานใน Booking (เอาเฉพาะที่ยังไม่ถูกลบ)
 * ✅ เปลี่ยนให้ JOIN employees เพื่อดึงข้อมูลบุคคลจากตาราง employees
 */
async function getEmployeesByTrainingId(trainingId) {
  const sql = `
    SELECT
      bd.booking_detail_id,
      bc.draft_id,
      bc.booking_code,
      bc.courses_code,
      bd.employee_code,
      NULLIF(CONCAT_WS(' ', e.titlename_th, e.firstname_th, e.lastname_th), '') AS fullname_th,
      e.department,
      e.position,
      e.worksites,
      e.sign_date,
      e.resign_date
    FROM booking_courses bc
    JOIN booking_detail bd
      ON bd.draft_id = bc.draft_id
    LEFT JOIN employees e
      ON e.employee_code = bd.employee_code
    WHERE bc.booking_courses_id = ?
      AND bd.is_status != 99
  `;
  const [rows] = await db.query(sql, [trainingId]);
  return rows;
}


/** Create Transaction */
async function create(data, userId) {
  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    const {
      courses_code, courses_name, start_date, end_date,
      start_time, end_time, location_code, location_name,
      remark, selectedEmployees
    } = data;

    const fmtStartTime = start_time ? ((start_time.length === 5) ? `${start_time}:00` : start_time) : null;
    const fmtEndTime = end_time ? ((end_time.length === 5) ? `${end_time}:00` : end_time) : null;

    const duration_date = calculateDurationDate(start_date, end_date);
    const duration_time = calculateDurationTime(fmtStartTime, fmtEndTime);
    const attendees = selectedEmployees ? selectedEmployees.length : 0;

    // ✅ คำนวณ Status
    const status = calculateStatus(start_date, end_date, fmtStartTime, fmtEndTime);

    const draft_id = await generateDraftId(conn);
    const hasEmployees = selectedEmployees && selectedEmployees.length > 0;

    let booking_code = null;
    if (hasEmployees) {
      booking_code = await generateBookingCode(conn);
    }

    const bookingCoursesId = await getNextId(conn, 'booking_courses', 'booking_courses_id');
    const sqlCourses = `
      INSERT INTO booking_courses (
        booking_courses_id,
        draft_id, booking_code, courses_code, courses_name,
        start_date, end_date, duration_date,
        start_time, end_time, duration_time,
        location_code, location_name, remark,
        attendees, is_status, -- ✅ เพิ่ม Status
        created_at, created_by, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), ?)
    `;

    await conn.query(sqlCourses, [
      bookingCoursesId,
      draft_id, booking_code, courses_code, courses_name,
      start_date, end_date, duration_date,
      fmtStartTime, fmtEndTime, duration_time,
      location_code, location_name, remark,
      attendees, status,
      userId, userId
    ]);

    if (hasEmployees) {
      let nextDetailId = await getNextId(conn, 'booking_detail', 'booking_detail_id');

      const sqlDetail = `
        INSERT INTO booking_detail (
          booking_detail_id,
          draft_id, booking_code, courses_code,
          employee_code,
          is_status,
          created_at, created_by, updated_at, updated_by
        ) VALUES ?
      `;

      const now = new Date();
      const detailValues = selectedEmployees.map(emp => [
        nextDetailId++,
        draft_id,
        booking_code,
        courses_code,
        emp.employee_code,
        status,
        now, userId, now, userId
      ]);

      await conn.query(sqlDetail, [detailValues]);

    }

    await conn.commit();
    return { draft_id, booking_code };

  } catch (error) {
    await conn.rollback();
    console.error("🔥 SQL Error in create training:", error.sqlMessage || error.message);
    throw error;
  } finally {
    conn.release();
  }
}

/** * UPDATE Function (With Soft Delete Logic for Details)
 */
async function update(id, data, userId) {
  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    const {
      courses_code, courses_name, start_date, end_date,
      start_time, end_time, location_code, location_name,
      remark, selectedEmployees
    } = data;

    const [existing] = await conn.query(
      `SELECT draft_id, booking_code FROM booking_courses WHERE booking_courses_id = ?`,
      [id]
    );

    if (existing.length === 0) throw new Error('Training record not found');

    const currentDraftId = existing[0].draft_id;
    let currentBookingCode = existing[0].booking_code;

    const fmtStartTime = start_time ? ((start_time.length === 5) ? `${start_time}:00` : start_time) : null;
    const fmtEndTime = end_time ? ((end_time.length === 5) ? `${end_time}:00` : end_time) : null;

    const duration_date = calculateDurationDate(start_date, end_date);
    const duration_time = calculateDurationTime(fmtStartTime, fmtEndTime);
    const attendees = selectedEmployees ? selectedEmployees.length : 0;

    // ✅ คำนวณ Status ใหม่
    const status = calculateStatus(start_date, end_date, fmtStartTime, fmtEndTime);

    const hasEmployees = selectedEmployees && selectedEmployees.length > 0;
    if (hasEmployees && !currentBookingCode) {
      currentBookingCode = await generateBookingCode(conn);
    }

    // 1. Update Header (booking_courses)
    const sqlUpdate = `
      UPDATE booking_courses SET
        courses_code = ?, courses_name = ?,
        start_date = ?, end_date = ?, duration_date = ?,
        start_time = ?, end_time = ?, duration_time = ?,
        location_code = ?, location_name = ?,
        remark = ?, attendees = ?, booking_code = ?, 
        is_status = ?, -- ✅ Update Status
        updated_at = NOW(), updated_by = ?
      WHERE booking_courses_id = ?
    `;

    await conn.query(sqlUpdate, [
      courses_code, courses_name,
      start_date, end_date, duration_date,
      fmtStartTime, fmtEndTime, duration_time,
      location_code, location_name, remark,
      attendees, currentBookingCode,
      status, // ✅ ใส่ค่า Status ใหม่
      userId, id
    ]);

    // 2. Handle Booking Details (Soft Delete Logic)

    // 2.1 ดึงรายการเดิมทั้งหมด (รวมที่เคยถูกลบไปแล้วเผื่อกู้คืน หรือสนใจเฉพาะ active ก็ได้)
    const [oldDetails] = await conn.query(
      `SELECT employee_code FROM booking_detail WHERE draft_id = ? AND is_status != 99`,
      [currentDraftId]
    );
    const oldEmpCodes = oldDetails.map(d => d.employee_code);

    // รายชื่อพนักงานใหม่ที่ส่งมา (New List)
    const newEmpCodes = selectedEmployees ? selectedEmployees.map(e => e.employee_code) : [];

    // A. หาคนที่ต้อง Soft Delete (มีใน Old แต่ไม่มีใน New)
    const toDelete = oldEmpCodes.filter(code => !newEmpCodes.includes(code));

    // B. หาคนที่ต้อง Insert เพิ่ม (ไม่มีใน Old แต่มีใน New)
    const toInsertCodes = newEmpCodes.filter(code => !oldEmpCodes.includes(code));
    const toInsertEmps = selectedEmployees.filter(e => toInsertCodes.includes(e.employee_code));

    // C. คนที่ยังอยู่ (มีทั้ง Old และ New) -> Update Status
    const toUpdateCodes = newEmpCodes.filter(code => oldEmpCodes.includes(code));

    // Execute Soft Delete (Update is_status = 99)
    if (toDelete.length > 0) {
      await conn.query(`
        UPDATE booking_detail 
        SET is_status = 99, deleted_at = NOW(), deleted_by = ?
        WHERE draft_id = ? AND employee_code IN (?)
      `, [userId, currentDraftId, toDelete]);
    }

    // Execute Update Existing (Update Status to match Header)
    if (toUpdateCodes.length > 0) {
      await conn.query(`
        UPDATE booking_detail 
        SET is_status = ?, booking_code = ?, courses_code = ?, updated_at = NOW(), updated_by = ?
        WHERE draft_id = ? AND employee_code IN (?)
      `, [status, currentBookingCode, courses_code, userId, currentDraftId, toUpdateCodes]);
    }

    // Execute Insert New
    if (toInsertEmps.length > 0) {
      let nextDetailId = await getNextId(conn, 'booking_detail', 'booking_detail_id');
      const now = new Date();

      const insertValues = toInsertEmps.map(emp => [
        nextDetailId++,
        currentDraftId,
        currentBookingCode,
        courses_code,
        emp.employee_code,
        status,
        now, userId, now, userId
      ]);

      const sqlInsert = `
        INSERT INTO booking_detail (
          booking_detail_id,
          draft_id, booking_code, courses_code,
          employee_code,
          is_status,
          created_at, created_by, updated_at, updated_by
        ) VALUES ?
      `;
      await conn.query(sqlInsert, [insertValues]);
    }

    await conn.commit();
    return { booking_courses_id: id, booking_code: currentBookingCode, draft_id: currentDraftId };

  } catch (error) {
    await conn.rollback();
    console.error("🔥 SQL Error in update training:", error.sqlMessage || error.message);
    throw error;
  } finally {
    conn.release();
  }
}

/** * ✅ Soft Delete Function (ลบข้อมูลแบบ Soft Delete) 
 */
async function softDelete(id, userId) {
  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // 1. หา draft_id
    const [rows] = await conn.query(`SELECT draft_id FROM booking_courses WHERE booking_courses_id = ?`, [id]);
    if (rows.length === 0) throw new Error('Record not found');
    const draftId = rows[0].draft_id;

    // 2. Soft Delete Header (booking_courses)
    await conn.query(`
      UPDATE booking_courses 
      SET is_status = 99, deleted_at = NOW(), deleted_by = ?
      WHERE booking_courses_id = ?
    `, [userId, id]);

    // 3. Soft Delete Detail (booking_detail)
    if (draftId) {
      await conn.query(`
        UPDATE booking_detail 
        SET is_status = 99, deleted_at = NOW(), deleted_by = ?
        WHERE draft_id = ?
      `, [userId, draftId]);
    }

    await conn.commit();
    return { booking_courses_id: id, success: true };

  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/** * ✅ Helper: ฟังก์ชันสำหรับเริ่มระบบ Auto Update (Cron Job) 
 * ทำงานทุกๆ 10 วินาที เพื่อตรวจสอบและอัปเดตสถานะ
 */
function startAutoUpdate(io, intervalMs = 10000) {
  console.log("🕒 Training Status Auto-Update Service Started...");

  // เรียกครั้งแรกทันทีที่ Start Server
  (async () => {
    const conn = await db.getConnection();
    try { await updateAllStatuses(conn, io); }
    catch (e) { console.error(e); }
    finally { conn.release(); }
  })();

  // ตั้งเวลาทำซ้ำ
  setInterval(async () => {
    const conn = await db.getConnection();
    try {
      // เรียกใช้ฟังก์ชัน updateAllStatuses เดิมที่มีอยู่แล้ว
      await updateAllStatuses(conn, io);
    } catch (err) {
      console.error("Auto update cron error:", err);
    } finally {
      conn.release();
    }
  }, intervalMs);
}

module.exports = {
  getAll,
  getCoursesList,
  getLocationsList,
  getEmployeeList,
  getEmployeesByTrainingId,
  create,
  update,
  softDelete,
  startAutoUpdate
};