const express = require('express')
const router = express.Router()
const attendanceController = require('../controller/attendance')
const authorization = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.post('/clock', authorization, attendanceController.clock)

router.get('/my', authorization, attendanceController.getMyAttendance)

router.get('/today', authorization, validateStoreAccess, attendanceController.getTodayAttendance)

router.get('/by-shift', authorization, validateStoreAccess, attendanceController.getByShift)

module.exports = router