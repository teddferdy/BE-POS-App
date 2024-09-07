const express = require('express')
// Contollers
const employeeController = require('../controller/employee')
const authorization = require('../../utils/authorization')
const router = express.Router()

// Get All Employee
router.get('/get-all-employee', authorization, employeeController?.getAllUser)

router.post('/set-schedule-employee', authorization)

module.exports = router
