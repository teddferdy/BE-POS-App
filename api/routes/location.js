const express = require('express')
const router = express.Router()

const locationController = require('../controller/location')
// Authorization
const authorization = require('../../utils/authorization')

// Get All Location
router.get('/get-location', authorization, locationController?.getAllLocation)

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

// {
//     "nameStore": "Add New Store",
//     "address": "Address Bray",
//     "detailLocation": "Samping Pom Bensin",
//     "phoneNumber": "+6292312",
//     "status": true,
//     "createdBy": "teddy",
//     "modifiedBy": ""
// }
