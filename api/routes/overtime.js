const express = require('express')
const router = express.Router()

const overtimeController = require('../controller/overtime')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')
const { validate } = require('../middleware/validate')
const {
  createOvertimeSchema,
  updateOvertimeStatusSchema,
  postOvertimePayrollSchema
} = require('../validation/schemas')

router.get(
  '/get-overtime',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin', 'user'),
  overtimeController.getOvertimes
)

router.post(
  '/create-overtime',
  authorization,
  validateStoreAccess,
  validate(createOvertimeSchema),
  overtimeController.createOvertime
)

router.put(
  '/update-status/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(updateOvertimeStatusSchema),
  overtimeController.updateOvertimeStatus
)

router.put(
  '/cancel/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin', 'user'),
  overtimeController.cancelOvertime
)

router.post(
  '/post-payroll',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(postOvertimePayrollSchema),
  overtimeController.postOvertimePayroll
)

module.exports = router