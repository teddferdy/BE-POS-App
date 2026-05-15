const express = require('express')
const router = express.Router()
const locationController = require('../controller/location')
const authorization = require('../../utils/authorization')
const fs = require('fs')
const multer = require('multer')

const uploadDir = '/tmp/uploads'

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('image')

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.includes('sheet') || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true)
    } else {
      cb(new Error('Hanya file Excel yang diperbolehkan'))
    }
  }
})

const uploadImages = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
  }),
  limits: { fileSize: 5 * 1024 * 1024 }
}).array('images', 50)

// Location Template
router.get('/template', authorization, locationController.downloadTemplate)
router.post('/import', authorization, uploadExcel.single('file'), uploadImages, locationController.importLocation)

// Location CRUD
router.get('/get-location', locationController?.getAllLocation)
router.get('/get-location-all', authorization, locationController?.getAllLocationInTable)
router.post('/add-new-location', authorization, upload, locationController?.addNewLocation)
router.put('/edit-location', authorization, upload, locationController?.editLocationById)
router.delete('/delete-location/:id', authorization, locationController?.deleteLocationById)

module.exports = router
