// .src/modules/masterdata/employee/employeeRoutes.js
'use strict';
const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./employeeController');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

/** Resource: /api/employee */
// === Multer config ===
const ensureDir = (dir) => { try { fs.mkdirSync(dir, { recursive: true }); } catch { } };
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../../img/employee'); // => src/img/employee
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const id = req.params.employee_id;
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${id}${ext}`);
  },
});
const fileFilter = (_req, file, cb) => {
  const ok = /^image\//i.test(file.mimetype || '');
  cb(ok ? null : new Error('Only image files are allowed'), ok);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// === เดิม ===
router.get('/', auth, controller.getAll);
router.get('/next-code', auth, controller.getNextCode);
router.get('/check-code', auth, controller.checkCode);
router.get('/options', auth, controller.getOptions);

// เดิม: ออกให้ที่ (บัตร) — provinces/districts
router.get('/issued/provinces', auth, controller.getIssuedProvinces);
router.get('/issued/districts', auth, controller.getIssuedDistricts);

// ใหม่: ที่อยู่ตามแบบพาเหรด
router.get('/address/provinces', auth, controller.getAddressProvinces);
router.get('/address/districts', auth, controller.getAddressDistricts);
router.get('/address/subdistricts', auth, controller.getAddressSubDistricts);

// อัปโหลดรูปพนักงาน
router.post('/:employee_id/image', auth, upload.single('image'), controller.uploadImage);

// CRUD เดิม
router.post('/', auth, controller.create);
router.get('/detail/:employee_id', auth, controller.getOne);
router.put('/:employee_id', auth, controller.update);

/* ---------- PDF routes: ใส่อันเฉพาะก่อนอันครอบจักรวาล ---------- */
router.get('/code/:employee_code/pdf', auth, controller.printPdfByCode);  // ← ต้องมาก่อน
router.get('/:employee_id/pdf', auth, controller.printPdf);        // ← ตามหลัง

router.delete('/:employee_id', auth, controller.softDelete);

module.exports = router;