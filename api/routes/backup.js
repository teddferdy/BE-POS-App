const express = require('express')
const router = express.Router()
const backupController = require('../controller/backup')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get(
  '/schedule',
  authorization,
  requireRole('super_admin'),
  backupController.getSchedule
)
router.put(
  '/schedule',
  authorization,
  requireRole('super_admin'),
  backupController.setSchedule
)
router.post(
  '/create',
  authorization,
  requireRole('super_admin'),
  backupController.createBackup
)
router.get(
  '/list',
  authorization,
  validateStoreAccess,
  requireRole('super_admin'),
  backupController.listBackups
)
router.get(
  '/download/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin'),
  backupController.downloadBackup
)
router.post(
  '/restore/:id',
  authorization,
  requireRole('super_admin'),
  backupController.restoreBackup
)
router.delete(
  '/delete/:id',
  authorization,
  requireRole('super_admin'),
  backupController.deleteBackup
)

module.exports = router
