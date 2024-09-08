const express = require('express')
const router = express.Router()

const shiftController = require('../controller/shift')
// Authorization
const authorization = require('../../utils/authorization')

// Get All Shift
router.get('/get-shift', shiftController?.getAllShift)

// Add Shift
router.post('/add-new-shift', authorization, shiftController?.postNewShift)

// Edit Shift
router.put('/edit-shift/:id', authorization, shiftController?.editShiftById)

// Delete Shift
router.delete(
  '/delete-shift/:id',
  authorization,
  shiftController?.deleteShiftById
)

module.exports = router
