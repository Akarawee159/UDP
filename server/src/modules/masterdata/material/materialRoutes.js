// src/modules/settings/material/materialRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./materialController');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// --- Config Paths ---
const mainDir = path.join(__dirname, '../../../img/material');
const drawingDir = path.join(__dirname, '../../../img/material/drawing');

// สร้างโฟลเดอร์ถ้ายังไม่มี
[mainDir, drawingDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // แยกโฟลเดอร์ตามชื่อ Field
        if (file.fieldname.startsWith('drawing_')) {
            cb(null, drawingDir);
        } else {
            cb(null, mainDir);
        }
    },
    filename: (req, file, cb) => {
        const date = new Date();
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = String(date.getFullYear() + 543).slice(-2); // ปี พ.ศ. 2 หลัก
        const ext = path.extname(file.originalname);
        const targetDir = file.fieldname.startsWith('drawing_') ? drawingDir : mainDir;

        if (file.fieldname.startsWith('drawing_')) {
            // --- Logic ชื่อไฟล์ Drawing ---
            const code = req.body.material_code || 'UNK';
            const dateStr = `${d}${m}${y}`;

            // Prefix สำหรับค้นหา: "CODE_ddMMyy_"
            const searchPrefix = `${code}_${dateStr}_`;

            // ✅ สร้างตัวแปรไว้ที่ req เพื่อจำลำดับล่าสุดใน Request นี้ (แก้ปัญหาอัปโหลดพร้อมกันแล้วเลขซ้ำ)
            if (!req.reservedSequence) {
                req.reservedSequence = {};
            }

            // อ่านไฟล์จาก Disk
            fs.readdir(targetDir, (err, files) => {
                let maxSeq = 0;

                // 1. เช็คจากไฟล์ที่มีอยู่จริงบน Disk
                if (!err && files) {
                    files.forEach(f => {
                        if (f.startsWith(searchPrefix)) {
                            const rest = f.replace(searchPrefix, '');
                            const numPart = rest.split('.')[0];
                            const seq = parseInt(numPart, 10);

                            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
                        }
                    });
                }

                // 2. ✅ เช็คจากตัวแปรใน Memory (เผื่อไฟล์ก่อนหน้ายังเขียนไม่เสร็จ)
                if (req.reservedSequence[searchPrefix] && req.reservedSequence[searchPrefix] > maxSeq) {
                    maxSeq = req.reservedSequence[searchPrefix];
                }

                // คำนวณลำดับถัดไป
                const nextSeqNum = maxSeq + 1;

                // ✅ บันทึกลง Memory ว่าเลขนี้ใช้แล้วนะ
                req.reservedSequence[searchPrefix] = nextSeqNum;

                const nextSeqStr = String(nextSeqNum).padStart(4, '0');
                cb(null, `${searchPrefix}${nextSeqStr}${ext}`);
            });

        } else {
            // --- Logic เดิมสำหรับรูปหลัก ---
            const datePrefix = `MAT_${d}${m}${y}`;
            fs.readdir(targetDir, (err, files) => {
                let maxSeq = 0;
                if (!err && files) {
                    files.forEach(f => {
                        if (f.startsWith(datePrefix)) {
                            const part = f.replace(datePrefix, '').split('.')[0];
                            const seq = parseInt(part, 10);
                            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
                        }
                    });
                }
                const nextSeq = String(maxSeq + 1).padStart(3, '0');
                cb(null, `${datePrefix}${nextSeq}${ext}`);
            });
        }
    }
});

const upload = multer({ storage: storage });

const cpUpload = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'drawing_001', maxCount: 1 },
    { name: 'drawing_002', maxCount: 1 },
    { name: 'drawing_003', maxCount: 1 },
    { name: 'drawing_004', maxCount: 1 },
    { name: 'drawing_005', maxCount: 1 },
    { name: 'drawing_006', maxCount: 1 },
]);

router.get('/', auth, controller.getAll);
router.get('/options', auth, controller.getOptions);
router.get('/check-code', auth, controller.checkCode);
router.get('/:material_id', auth, controller.getById);

router.post('/', auth, cpUpload, controller.create);
router.put('/:material_id', auth, cpUpload, controller.update);

router.delete('/:material_id', auth, controller.remove);

module.exports = router;