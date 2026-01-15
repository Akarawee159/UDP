// src/modules/settings/material/materialRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./materialController');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// --- Config Upload ---
const uploadDir = path.join(__dirname, '../../../img/material');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // สร้างชื่อไฟล์: MAT_ddMMyyXXX (นับลำดับต่อวัน)
        const date = new Date();
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = String(date.getFullYear() + 543).slice(-2); // ปี พ.ศ. 2 หลัก
        const datePrefix = `MAT_${d}${m}${y}`; // e.g., MAT_150126

        // หาไฟล์ล่าสุดของวันนี้เพื่อนับลำดับ
        fs.readdir(uploadDir, (err, files) => {
            let maxSeq = 0;
            if (!err && files) {
                files.forEach(f => {
                    if (f.startsWith(datePrefix)) {
                        // ดึงเลข 3 หลักท้าย
                        const part = f.replace(datePrefix, '').split('.')[0];
                        const seq = parseInt(part, 10);
                        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
                    }
                });
            }
            const nextSeq = String(maxSeq + 1).padStart(3, '0');
            const ext = path.extname(file.originalname);
            cb(null, `${datePrefix}${nextSeq}${ext}`);
        });
    }
});

const upload = multer({ storage: storage });

// --- Routes ---
router.get('/', auth, controller.getAll);
router.get('/options', auth, controller.getOptions); // Endpoint สำหรับ Dropdown
router.get('/check-code', auth, controller.checkCode);
router.get('/:material_id', auth, controller.getById);

// ใช้ upload.single('image') รองรับการส่งไฟล์
router.post('/', auth, upload.single('image'), controller.create);
router.put('/:material_id', auth, upload.single('image'), controller.update);

router.delete('/:material_id', auth, controller.remove);

module.exports = router;