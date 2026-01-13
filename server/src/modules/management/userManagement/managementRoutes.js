'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const managementController = require('./managementController');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

// === Multer storages ===
const PROFILE_DIR = path.join(__dirname, '../../../img/profile');
const SIGN_DIR = path.join(__dirname, '../../../img/signature');
ensureDir(PROFILE_DIR); ensureDir(SIGN_DIR);

const profileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PROFILE_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.png').toLowerCase() || '.png';
    cb(null, `PRO_${req.user.employee_id}${ext}`);
  }
});
const signatureStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, SIGN_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.png').toLowerCase() || '.png';
    cb(null, `SIG_${req.user.employee_id}${ext}`);
  }
});

const imageFileFilter = (req, file, cb) => {
  // อนุญาตเฉพาะไฟล์รูปภาพ
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/gif') {
    cb(null, true);
  } else {
    // ปฏิเสธไฟล์อื่น ๆ
    cb(new Error('รองรับเฉพาะไฟล์รูปภาพ (jpeg, png, gif) เท่านั้น'), false);
  }
};

const uploadProfile = multer({
  storage: profileStorage,
  fileFilter: imageFileFilter, // ⬅️ เพิ่มตัวกรองประเภทไฟล์
  limits: { fileSize: 5 * 1024 * 1024 } // ⬅️ จำกัดขนาดไฟล์ที่ 5MB
});

const uploadSignature = multer({
  storage: signatureStorage,
  fileFilter: imageFileFilter, // ⬅️ ใช้ตัวกรองเดียวกัน
  limits: { fileSize: 2 * 1024 * 1024 } // ⬅️ จำกัดขนาดไฟล์ที่ 2MB
});

/** Resource: /management */
router.get('/', auth, managementController.getAll);

// กลุ่มสิทธิทั้งหมด (สำหรับ dropdown)
router.get('/groups', auth, managementController.getGroups);

// รายชื่อสาขา + รายชื่อพนักงานตามสาขา
router.get('/branches', auth, managementController.getBranches);
router.get('/employees', auth, managementController.getEmployeesByBranch);

// ตรวจสอบ username ซ้ำ + อัปเดต username
router.get('/check-username', auth, managementController.checkUsername);
router.patch('/:employee_id/username', auth, managementController.updateUsername);

// อัปเดตสถานะอนุญาต/ห้ามใช้งาน
router.patch('/:employee_id/status', auth, managementController.updateStatus);

// ✅ (เพิ่มใหม่) กดปุ่ม "รับทราบ" (เปลี่ยน status 4 -> 5)
router.patch('/:employee_id/ack-reset', auth, managementController.acknowledgeReset);

// อัปเดตกลุ่มสิทธิของพนักงาน
router.patch('/:employee_id/permission', auth, managementController.updatePermissionRole);


// ✅ เคลียร์บัญชีผู้ใช้ (Soft delete)
router.patch('/:employee_id/clear-account', auth, managementController.clearAccount);

// === Me routes ===
router.get('/me', auth, managementController.getMe);
router.patch('/me/password', auth, managementController.updateMyPassword);
router.post('/me/profile-image', auth, uploadProfile.single('file'), managementController.uploadProfileImage);
router.post('/me/signature', auth, uploadSignature.single('file'), managementController.uploadSignatureImage);

// จากนั้นค่อยตามด้วยพวกไดนามิก ✅ รีเซ็ทรหัสผ่าน
router.patch('/:employee_id/password', auth, managementController.resetPassword);

// ลบรูปโปรไฟล์และลายเซ็น
router.delete('/me/profile-image', auth, managementController.deleteProfileImage);
router.delete('/me/signature', auth, managementController.deleteSignatureImage);


module.exports = router;
