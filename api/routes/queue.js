const express = require('express')
const router = express.Router()
const queueController = require('../controller/queue')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')
const { validate } = require('../middleware/validate')
const {
  createQueueSchema,
  updateQueueSchema,
  updateQueueStatusSchema
} = require('../validation/schemas')

// ─── Queue Management ─────────────────────────────────────────────

router.get(
  '/',
  authorization,
  validateStoreAccess,
  queueController.getQueueList
)

router.get(
  '/stats',
  authorization,
  validateStoreAccess,
  queueController.getQueueStats
)

router.get(
  '/:id',
  authorization,
  validateStoreAccess,
  queueController.getQueueById
)

router.post(
  '/',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin', 'kasir'),
  validate(createQueueSchema),
  queueController.createQueue
)

router.put(
  '/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin', 'kasir'),
  validate(updateQueueSchema),
  queueController.updateQueue
)

router.put(
  '/:id/status',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin', 'kasir'),
  validate(updateQueueStatusSchema),
  queueController.updateQueueStatus
)

router.delete(
  '/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  queueController.deleteQueue
)

module.exports = router
