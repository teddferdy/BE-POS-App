const express = require('express')
const router = express.Router()

const positionController = require('../controller/position')
// Authorization
const authorization = require('../../utils/authorization')

// Get All position
router.get('/get-position', positionController?.getAllPosition)

// Get All List To Table
router.get(
  '/get-position-all',
  authorization,
  positionController?.getAllPositionInTable
)

// Add position
router.post(
  '/add-new-position',
  authorization,
  positionController?.addNewPosition
)

// Edit position
router.put(
  '/edit-position/:id',
  authorization,
  positionController?.editPositionById
)

// Delete position
router.delete(
  '/delete-position/:id',
  authorization,
  positionController?.deletePositionById
)

module.exports = router
