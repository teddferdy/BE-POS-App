const express = require('express')
const router = express.Router()

const locationController = require('../controller/location')
const authorization = require('../../utils/authorization')
const fs = require('fs')
const multer = require('multer')

// Define the writable upload directory for serverless environments
const uploadDir = '/tmp/uploads'

// Ensure the /tmp/uploads directory exists (required for AWS Lambda)
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Set up multer storage using /tmp/uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir) // Save files to /tmp/uploads
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // Set file size limit to 5MB
}).single('image')

// Get All Location
router.get('/get-location', locationController?.getAllLocation)

// Get All List To Table
router.get(
  '/get-location-all',
  authorization,
  locationController?.getAllLocationInTable
)

// Add Location with file upload
router.post(
  '/add-new-location',
  authorization,
  upload, // Use multer middleware for handling file uploads
  locationController?.addNewLocation
)

// Edit Location
router.put(
  '/edit-location',
  authorization,
  upload,
  locationController?.editLocationById
)

// Delete Location
router.delete(
  '/delete-location/:id',
  authorization,
  locationController?.deleteLocationById
)

module.exports = router
