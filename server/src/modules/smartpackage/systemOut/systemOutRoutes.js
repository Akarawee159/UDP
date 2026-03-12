// src/modules/Smartpackage/systemOut/systemOutRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./systemOutController');

router.get('/', auth, controller.getBookingList);             // Main Table (Bookings)
router.get('/detail', auth, controller.getBookingDetail);     // Booking Detail (Header + Assets)
router.post('/init-booking', auth, controller.initBooking);   // Create Draft ID
router.get('/list', auth, controller.getScannedList);         // List by Draft ID
router.post('/scan', auth, controller.scanAsset);             // Scan
router.post('/return-single', auth, controller.returnSingle); // Return from Modal
router.post('/return', auth, controller.returnAssets);        // Batch Return
router.post('/confirm', auth, controller.confirmBooking);     // Save/Gen RefID
router.post('/cancel', auth, controller.cancelBooking);       // Cancel Booking
router.post('/finalize', auth, controller.finalizeBooking);   //  ใช้งาน
router.post('/edit-header', auth, controller.editHeader); // กดแก้ไขข้อมูลใช้งาน
router.post('/unlock', auth, controller.unlockBooking);       //  ปลดล็อค
router.post('/confirm-output', auth, controller.confirmOutput); // ยืนยันการใช้งาน (112 -> 115)
router.get('/dropdowns', auth, controller.getDropdowns);      // Dropdowns
router.post('/print-pdf', auth, controller.printUsagePDF); // พิมพ์ใบใช้งาน

module.exports = router;