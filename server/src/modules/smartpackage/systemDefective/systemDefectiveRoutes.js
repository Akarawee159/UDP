// src/modules/Smartpackage/systemDefective/systemDefectiveRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./systemDefectiveController');

router.get('/', auth, controller.getBookingList);             // Main Table (Bookings)
router.get('/detail', auth, controller.getBookingDetail);     // Booking Detail (Header + Assets)
router.post('/init-booking', auth, controller.initBooking);   // Create Draft ID
router.get('/list', auth, controller.getScannedList);         // List by Draft ID
router.post('/scan', auth, controller.scanAsset);             // Scan
router.post('/return-single', auth, controller.returnSingle); // Return from Modal
router.post('/return', auth, controller.returnAssets);        // Batch Return
router.post('/confirm', auth, controller.confirmBooking);     // Save/Gen RefID
router.post('/cancel', auth, controller.cancelBooking);       // Cancel Booking
router.post('/finalize', auth, controller.finalizeBooking);   //  แจ้งชำรุด
router.post('/edit-header', auth, controller.editHeader); // กดแก้ไขข้อมูลแจ้งชำรุด
router.post('/unlock', auth, controller.unlockBooking);       //  ปลดล็อค
router.post('/confirm-output', auth, controller.confirmOutput); // ยืนยันการแจ้งชำรุด
router.get('/dropdowns', auth, controller.getDropdowns);      // Dropdowns
router.get('/defective-items', auth, controller.getDefectiveItems);
router.post('/receive-stock', auth, controller.receiveToStock);

module.exports = router;