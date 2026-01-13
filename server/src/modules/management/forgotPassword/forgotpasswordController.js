// src/modules/management/forgotPassword/forgotpasswordController.js
'use strict';
const model = require('./forgotpasswordModel');
const { verifyJwtAndTV } = require('../../../auth/middleware/authMiddleware');

async function getAll(_req, res) {
  // ... (เหมือนเดิม)
  try {
    const rows = await model.getAll();
    return res.status(200).json({ success: true, message: 'OK', count: rows.length, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
}

// ✅ เพิ่ม Controller สำหรับค้นหาสถานะ (Track Request)
async function checkStatus(req, res) {
    try {
        console.log("🔍 Check Status Payload:", req.body); // ดู Log ที่ Terminal ว่าส่งอะไรมา

        const { keyword } = req.body;

        // ถ้าไม่ส่งมา หรือส่งมาเป็นค่าว่าง
        if (!keyword || String(keyword).trim() === '') {
            return res.status(400).json({ success: false, message: 'กรุณาระบุรหัสพนักงานหรือชื่อผู้ใช้งาน' });
        }

        const result = await model.findRequestByKeyword(keyword);

        if (!result) {
            return res.status(404).json({ success: false, message: 'ไม่พบคำขอดำเนินการรีเซ็ทรหัสผ่านในระบบ' });
        }

        return res.status(200).json({ success: true, data: result });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดของระบบ' });
    }
}

async function requestReset(req, res) {
  try {
    const { employee_code, username } = req.body;
    
    if (!employee_code || !username) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุข้อมูลให้ครบถ้วน' });
    }

    const result = await model.requestResetPassword(employee_code, username);

    if (!result.success) {
        return res.status(404).json(result); // กรณีไม่พบ User
    }

    // ✅ Socket Event: ส่งเฉพาะเมื่อมีการ Update ใหม่ (ถ้า existing = true อาจจะไม่ต้องส่ง หรือส่งก็ได้แล้วแต่ดีไซน์)
    // ในที่นี้ถ้า existing = false แสดงว่าเพิ่งเปลี่ยนสถานะเป็น 4 -> ส่ง Notify
    if (!result.existing) {
        const io = req.app.get('io');
        if (io) {
            const payload = { employee_code: result.employee_code, is_status: result.status };
            io.emit('forgot_password:update', payload);
        }
    }

    return res.status(200).json({ 
        success: true, 
        message: result.existing ? 'คำขอนี้อยู่ระหว่างดำเนินการแล้ว' : 'ส่งคำขอเรียบร้อยแล้ว', 
        data: result 
    });

  } catch (err) {
    console.error('Failed to request reset:', err);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดของระบบ' });
  }
}

// ✅ Helper: ดึง user จาก JWT
async function getAuthUser(req) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token) return null;

    const user = await verifyJwtAndTV(token);
    return user || null;
  } catch (err) {
    console.error('verifyJwtAndTV failed:', err);
    return null;
  }
}

// ✅ Helper: เช็คสิทธิ์ main_menu:20 + sub_menu:201
async function ensureAdmin(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' });
    return null;
  }

  // ปรับ field ตาม payload ของ JWT ถ้าใช้ชื่ออื่น
  const roleName =
    user.permission_role || user.group_name || user.roleName || null;

  if (!roleName) {
    res.status(403).json({ success: false, message: 'ไม่พบสิทธิ์การใช้งาน' });
    return null;
  }

  const allowed = await model.checkAdminPermission(roleName);
  if (!allowed) {
    res.status(403).json({
      success: false,
      message: 'ไม่มีสิทธิ์จัดการคำขอรีเซ็ตรหัสผ่าน',
    });
    return null;
  }

  return user;
}

// ✅ สำหรับ Navbar: ดึงรายการคำขอที่ is_status = 4
async function listPendingForAdmin(req, res) {
  try {
    const user = await ensureAdmin(req, res);
    if (!user) return;

    const rows = await model.getPendingRequests();
    return res
      .status(200)
      .json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('getPendingRequests error:', err);
    return res
      .status(500)
      .json({ success: false, message: 'เกิดข้อผิดพลาดของระบบ' });
  }
}

// ✅ ปุ่ม "รับทราบ" → อัปเดตเป็น is_status = 5 + broadcast ผ่าน Socket.IO
async function acknowledgeRequest(req, res) {
  try {
    const user = await ensureAdmin(req, res);
    if (!user) return;

    const { employee_code } = req.body || {};
    
    if (!employee_code) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุรหัสพนักงาน' });
    }

    // 1. อัปเดตสถานะลง DB
    const result = await model.updateStatus(employee_code, '5');

    if (result.affectedRows === 0) {
        return res.status(404).json({ 
            success: false, 
            message: `ไม่พบพนักงานรหัส "${employee_code}" หรือสถานะไม่ได้ถูกเปลี่ยน` 
        });
    }

    // 2. ✅ ดึงข้อมูลพนักงานเพื่อเอา employee_id
    const empRow = await model.getStatusByCode(employee_code);

    // 3. Broadcast ผ่าน Socket.IO
    const io = req.app.get('io');
    if (io) {
      // Event 1: สำหรับ Navbar (ให้รายการแจ้งเตือนหายไป)
      io.emit('forgot_password:update', {
        employee_code,
        is_status: '5',
      });

      // Event 2: ✅✅ สำหรับ UserManagement (ให้อัปเดตตารางทันทีโดยไม่ต้องรีเฟรช)
      if (empRow && empRow.employee_id) {
        io.emit('user:status', {
            employee_id: empRow.employee_id, // ใช้ ID ที่หน้า UserManagement รู้จัก
            is_status: 5
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'อัปเดตสถานะเป็นกำลังดำเนินการแล้ว',
      data: result,
    });
  } catch (err) {
    console.error('acknowledgeRequest error:', err);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดของระบบ' });
  }
}


module.exports = {
  getAll,
  requestReset,
  checkStatus,
  listPendingForAdmin,
  acknowledgeRequest,
};
