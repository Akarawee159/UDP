'use strict';

const model = require('./managementModel');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs').promises;
const PROFILE_DIR = path.join(__dirname, '../../../img/profile');
const SIGN_DIR = path.join(__dirname, '../../../img/signature');

// helper: ดึง row ล่าสุดแล้วยิง user:upsert
async function emitUpsert(req, employee_id) {
  try {
    const io = req.app.get('io');
    if (!io) return;
    const row = await model.getEmployeeById(employee_id); // คืนฟิลด์ครบ ใช้ขึ้นตารางได้เลย
    if (row) io.emit('user:upsert', row);
  } catch (e) { /* เงียบได้ */ }
}


/** GET /management */
async function getAll(_req, res, next) {
  try {
    const rows = await model.getAll();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

/** GET /management/groups */
async function getGroups(_req, res, next) {
  try {
    const rows = await model.getPermissionGroups();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

/** PATCH /management/:employee_id/status */
async function updateStatus(req, res, next) {
  try {
    const { employee_id } = req.params;
    const { is_status } = req.body; // 1 หรือ 3
    await model.updateStatus(employee_id, is_status);
    // ยิงสถานะแบบสั้น ๆ ให้ Badge เปลี่ยนทันที
    const io = req.app.get('io');
    io?.emit('user:status', { employee_id: Number(employee_id), is_status: Number(is_status) });
    // ยิงแถวเต็ม ๆ ให้ตาราง sync ฟิลด์อื่นด้วย (is_status, profileImg ฯลฯ)
    await emitUpsert(req, employee_id);
    res.json({ success: true, employee_id, is_status });
  } catch (err) {
    next(err);
  }
}

/** PATCH /management/:employee_id/permission */
async function updatePermissionRole(req, res, next) {
  try {
    const { employee_id } = req.params;
    const { group_name } = req.body; // ชื่อกลุ่มจาก permission_group.group_name
    await model.updatePermissionRole(employee_id, group_name);
    await emitUpsert(req, employee_id);
    res.json({ success: true, employee_id, permission_role: group_name });
  } catch (err) {
    next(err);
  }
}

/** PATCH /management/:employee_id/password */
async function resetPassword(req, res, next) {
  try {
    const { employee_id } = req.params;
    const { new_password, expiry_days, password_expiry_days } = req.body || {};

    // 1. ✅ ดึงข้อมูลพนักงานก่อนทำการเปลี่ยนรหัส (เพื่อเช็คสถานะ is_status)
    const currentUser = await model.getEmployeeById(employee_id);
    if (!currentUser) {
      const e = new Error('ไม่พบข้อมูลพนักงาน');
      e.status = 404; throw e;
    }

    // ... (Validation code เดิม) ...
    const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;
    if (!new_password || !strong.test(String(new_password))) {
      const err = new Error('ต้องมี ตัวเล็ก/ใหญ่/ตัวเลข/อักขระพิเศษ และยาว ≥ 8 ตัว');
      err.status = 400;
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(String(new_password), salt);

    const DEFAULT_EXP = Number(process.env.PASSWORD_DEFAULT_EXPIRY_DAYS || 90);
    const clamp = (d) => {
      const n = Number(d);
      if (!Number.isFinite(n)) return DEFAULT_EXP;
      return Math.max(1, Math.min(3650, Math.floor(n)));
    };
    const days = clamp(expiry_days ?? password_expiry_days ?? DEFAULT_EXP);

    // 2. อัปเดตรหัสผ่าน
    const { affectedRows } = await model.updatePasswordWithExpiry(employee_id, hash, days);
    if (!affectedRows) {
      const e = new Error('ไม่พบผู้ใช้ที่ต้องการอัปเดต');
      e.status = 404; throw e;
    }

    const io = req.app.get('io');

    // 3. ✅ [Logic เดิม] ถ้าสถานะเดิมคือ 5 (รับเรื่องแล้ว) ให้เปลี่ยนเป็น 6 (เสร็จสิ้น)
    if (Number(currentUser.is_status) === 5) {
      await model.completeResetStatus(employee_id);

      if (io) {
        io.emit('user:status', { employee_id: Number(employee_id), is_status: 6 });
        if (currentUser.employee_code) {
          io.emit('forgot_password:update', { employee_code: currentUser.employee_code, is_status: 6 });
        }
      }
      await emitUpsert(req, employee_id);
    }

    // 4. ⭐ [เพิ่มใหม่] ถ้าสถานะเดิมคือ 2 (Locked/ระงับ) ให้เปลี่ยนกลับเป็น 1 (ใช้งานได้)
    else if (Number(currentUser.is_status) === 2) {
      // ใช้ฟังก์ชัน updateStatus ที่มีอยู่แล้วเพื่อปรับเป็น 1
      await model.updateStatus(employee_id, 1);

      if (io) {
        // แจ้ง Frontend ให้เปลี่ยนสี Badge เป็นสีเขียว (Active)
        io.emit('user:status', {
          employee_id: Number(employee_id),
          is_status: 1
        });
      }
      // อัปเดตข้อมูลแถวนี้ทั้งหมดกลับไปที่ตาราง
      await emitUpsert(req, employee_id);
    }

    res.json({ success: true, employee_id, expires_in_days: days });
  } catch (err) {
    next(err);
  }
}

/* ---------------------- เพิ่มใหม่สำหรับ ModalCreate ---------------------- */

/** GET /management/branches */
async function getBranches(_req, res, next) {
  try {
    const branches = await model.getBranches();
    res.json({ success: true, data: branches });
  } catch (err) {
    next(err);
  }
}

/** GET /management/employees?branch=...&withoutUsername=1 */
async function getEmployeesByBranch(req, res, next) {
  try {
    const { branch, hasUsername, withoutUsername } = req.query;
    if (!branch || String(branch).trim() === '') {
      const e = new Error('branch is required');
      e.status = 400;
      throw e;
    }
    // priority: withoutUsername > hasUsername > all
    let filter = 'all';
    if (String(withoutUsername) === '1') filter = 'without';
    else if (String(hasUsername) === '1') filter = 'with';
    const rows = await model.getEmployeesByBranch(String(branch), { filter });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

/** GET /management/check-username?username=xxx&excludeId=... */
async function checkUsername(req, res, next) {
  try {
    const { username, excludeId } = req.query;
    if (!username || String(username).trim() === '') {
      const e = new Error('username is required');
      e.status = 400;
      throw e;
    }
    const exists = await model.isUsernameTaken(String(username).trim(), excludeId ? String(excludeId) : undefined);
    res.json({ success: true, exists });
  } catch (err) {
    next(err);
  }
}

/** PATCH /management/:employee_id/username { username } */
async function updateUsername(req, res, next) {
  try {
    const { employee_id } = req.params;
    const { username } = req.body;
    if (!username || String(username).trim() === '') {
      const e = new Error('Invalid username');
      e.status = 400;
      throw e;
    }
    await model.updateUsername(employee_id, username);
    await emitUpsert(req, employee_id);
    res.json({ success: true, employee_id, username: String(username).trim() });
  } catch (err) {
    next(err);
  }
}

/** PATCH /management/:employee_id/clear-account */
async function clearAccount(req, res, next) {
  try {
    const { employee_id } = req.params;
    await model.clearUserAccount(employee_id);
    await emitUpsert(req, employee_id);

    // แจ้งสถานะให้เป็นออฟไลน์ (1) เผื่อหน้าอื่นๆ ที่ยังเห็นผู้ใช้นี้อยู่
    const io = req.app.get('io');
    io?.emit('user:status', { employee_id: Number(employee_id), is_status: 1 });

    res.json({ success: true, employee_id });
    const io2 = req.app.get('io');
    io2?.emit('user:remove', { employee_id: Number(employee_id) });
  } catch (err) {
    next(err);
  }
}


/** GET /management/me */
async function getMe(req, res, next) {
  try {
    const me = await model.getEmployeeById(req.user.employee_id);
    res.json({ success: true, data: me });
  } catch (err) { next(err); }
}

/** PATCH /management/me/password { new_password } */
async function updateMyPassword(req, res, next) {
  try {
    const { new_password } = req.body;
    // ≥8 + ต้องมี a–z, A–Z, 0–9, อักขระพิเศษ
    const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;
    if (!new_password || !strong.test(String(new_password))) {
      const e = new Error('ต้องมี ตัวเล็ก/ใหญ่/ตัวเลข/อักขระพิเศษ และยาว ≥ 8 ตัว');
      e.status = 400; throw e;
    }
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(String(new_password), salt);
    const isRoot = String(req.user.employee_id) === '1';
    if (isRoot) {
      // admin (id=1) → เปลี่ยนรหัสอย่างเดียว
      await model.updateMyPassword(req.user.employee_id, hash);
      return res.json({ success: true, employee_id: req.user.employee_id });
    }
    // ผู้ใช้อื่น ๆ → ล็อควันหมดอายุที่ 90 วัน
    await model.updatePasswordWithExpiry(req.user.employee_id, hash, 90);
    res.json({ success: true, employee_id: req.user.employee_id, expires_in_days: 90 });
  } catch (err) { next(err); }
}

/** POST /management/me/profile-image (multipart/form-data: file) */
async function uploadProfileImage(req, res, next) {
  try {
    const filename = req.file?.filename;
    if (!filename) { const e = new Error('ไม่พบไฟล์อัปโหลด'); e.status = 400; throw e; }
    await model.updateProfileImage(req.user.employee_id, filename);
    await emitUpsert(req, req.user.employee_id);
    res.json({ success: true, filename });
  } catch (err) { next(err); }
}

/** POST /management/me/signature (multipart/form-data: file) */
async function uploadSignatureImage(req, res, next) {
  try {
    const filename = req.file?.filename;
    if (!filename) { const e = new Error('ไม่พบไฟล์อัปโหลด'); e.status = 400; throw e; }
    await model.updateSignatureImage(req.user.employee_id, filename);
    res.json({ success: true, filename });
  } catch (err) { next(err); }
}

// DELETE /management/me/profile-image
async function deleteProfileImage(req, res, next) {
  try {
    const me = await model.getEmployeeById(req.user.employee_id);
    const filename = me?.profileImg || null;

    // เคลียร์ DB ก่อน
    await model.updateProfileImage(req.user.employee_id, null);

    // ลบไฟล์จริง (ถ้ามี)
    if (filename) {
      const filePath = path.join(PROFILE_DIR, filename);
      await fs.unlink(filePath).catch(() => { });
    }
    await emitUpsert(req, req.user.employee_id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

// DELETE /management/me/signature
async function deleteSignatureImage(req, res, next) {
  try {
    const me = await model.getEmployeeById(req.user.employee_id);
    const filename = me?.signature || null;

    await model.updateSignatureImage(req.user.employee_id, null);

    if (filename) {
      const filePath = path.join(SIGN_DIR, filename);
      await fs.unlink(filePath).catch(() => { });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
}

/** ✅ (เพิ่มใหม่) PATCH /management/:employee_id/ack-reset */
async function acknowledgeReset(req, res, next) {
  try {
    const { employee_id } = req.params;

    // 1. อัปเดตลง Database (is_status = 5)
    await model.acknowledgeResetStatus(employee_id);

    // 2. ✅ เพิ่ม: ดึงข้อมูลพนักงานเพื่อเอา employee_code (จำเป็นสำหรับ Navbar)
    const emp = await model.getEmployeeById(employee_id);

    // 3. ส่ง Socket บอก Frontend
    const io = req.app.get('io');
    if (io) {
      // 3.1 Event สำหรับ UserManagement (เปลี่ยนไอคอน/สถานะในตาราง)
      io.emit('user:status', {
        employee_id: Number(employee_id),
        is_status: 5
      });

      // 3.2 ✅ Event สำหรับ Navbar (ลบการแจ้งเตือนออกทันที)
      if (emp && emp.employee_code) {
        io.emit('forgot_password:update', {
          employee_code: emp.employee_code,
          is_status: 5 // ส่งสถานะที่ไม่ใช่ 4 เพื่อให้ Navbar ลบออกจากลิสต์
        });
      }
    }

    // 4. ส่งข้อมูลแถวใหม่ทั้งหมดเผื่อมีการแก้ไขข้อมูลอื่น
    await emitUpsert(req, employee_id);

    res.json({ success: true, employee_id, is_status: 5 });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  getGroups,
  updateStatus,
  updatePermissionRole,
  resetPassword,
  getBranches,
  getEmployeesByBranch,
  checkUsername,
  updateUsername,
  clearAccount,
  getMe,
  updateMyPassword,
  uploadProfileImage,
  uploadSignatureImage,
  deleteProfileImage,
  deleteSignatureImage,
  acknowledgeReset,
};
