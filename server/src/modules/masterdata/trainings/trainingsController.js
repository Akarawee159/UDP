'use strict';

const model = require('./trainingsModel');
const db = require('../../../config/database');

// trainingsController.js

async function getAll(req, res, next) {
  try {
    // ✅ 1. รับ instance ของ io
    const io = req.app.get('io');

    // ✅ 2. ส่ง io ไปให้ model
    const rows = await model.getAll(io);

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function getOptions(_req, res, next) {
  try {
    const courses = await model.getCoursesList();
    const locations = await model.getLocationsList();
    res.json({ success: true, courses, locations });
  } catch (err) {
    next(err);
  }
}

async function getEmployees(_req, res, next) {
  try {
    const rows = await model.getEmployeeList();
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error getEmployees:", err);
    next(err);
  }
}

// ✅ เพิ่มฟังก์ชันนี้
async function getBookingEmployees(req, res, next) {
  try {
    const { id } = req.params;
    const rows = await model.getEmployeesByTrainingId(id);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error getBookingEmployees:", err);
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const createdBy = req.user?.employee_id || null;
    const result = await model.create(req.body, createdBy);

    const io = req.app.get('io');
    if (io) {
      const sql = `SELECT * FROM booking_courses WHERE booking_code = ? OR draft_id = ? LIMIT 1`;
      const [rows] = await db.query(sql, [result.booking_code, result.draft_id]);
      if (rows.length > 0) {
        io.emit('trainings:upsert', rows[0]);
      }
    }
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Error create training:", err);
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = req.params.id;
    const updatedBy = req.user?.employee_id || null;
    const result = await model.update(id, req.body, updatedBy);

    const io = req.app.get('io');
    if (io) {
      const sql = `SELECT * FROM booking_courses WHERE booking_courses_id = ?`;
      const [rows] = await db.query(sql, [id]);
      if (rows.length > 0) {
        io.emit('trainings:upsert', rows[0]);
      }
    }
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Error update training:", err);
    next(err);
  }
}

async function softDelete(req, res, next) {
  try {
    const id = req.params.id;
    const deletedBy = req.user?.employee_id || null;

    // เรียก Model Soft Delete
    await model.softDelete(id, deletedBy);

    // Notify Socket
    const io = req.app.get('io');
    if (io) {
      io.emit('trainings:delete', { booking_courses_id: Number(id) });
    }

    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    console.error("Error softDelete training:", err);
    next(err);
  }
}

module.exports = {
  getAll,
  getOptions,
  getEmployees,
  getBookingEmployees,
  create,
  update,
  softDelete
};