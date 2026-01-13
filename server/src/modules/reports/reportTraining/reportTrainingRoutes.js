'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../../auth/middleware/authMiddleware');
const controller = require('./reportTrainingController');

// options for dropdowns
router.get('/options/employees', auth, controller.optionsEmployees);
router.get('/options/courses', auth, controller.optionsCourses);
router.get('/options/booking-codes', auth, controller.optionsBookingCodes);

// ✅ expand data
router.get('/person-history', auth, controller.personHistory);
router.get('/topic-members', auth, controller.topicMembers);

// search report
router.get('/search', auth, controller.search);

// backward-compatible
router.get('/', auth, controller.search);

// ✅ PDF ประวัติการฝึกอบรมรายบุคคล
router.get('/person-pdf', auth, controller.personPdf);


module.exports = router;
