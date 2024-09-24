const express = require('express')
const router = express.Router()

const locationController = require('../controller/location')
// Authorization
const authorization = require('../../utils/authorization')

// Get All Location
router.get('/get-location', locationController?.getAllLocation)

// Get All List To Table
router.get(
  '/get-location-all',
  authorization,
  locationController?.getAllLocationInTable
)

// Add Location
router.post(
  '/add-new-location',
  authorization,
  locationController?.addNewLocation
)

// Edit Location
router.put(
  '/edit-location/:id',
  authorization,
  locationController?.editLocationById
)

// Delete Location
router.delete(
  '/delete-location/:id',
  authorization,
  locationController?.deleteLocationById
)

module.exports = router
