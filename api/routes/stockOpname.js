const express = require('express')
const router = express.Router()
const stockOpnameController = require('../controller/stockOpname')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')

// Get stock opname - All authenticated users
router.get('/get-all', authorization, stockOpnameController.getAll)
router.get('/get-by-id/:id', authorization, stockOpnameController.getById)

// Create/Update/Delete - Admin & Super Admin only
router.post('/create', requireRole('super_admin', 'admin'), stockOpnameController.create)
router.put('/update/:id', requireRole('super_admin', 'admin'), stockOpnameController.update)
router.delete('/delete/:id', requireRole('super_admin', 'admin'), stockOpnameController.delete)

// Complete/Cancel - Admin & Super Admin only
router.put('/complete/:id', requireRole('super_admin', 'admin'), stockOpnameController.complete)
router.put('/cancel/:id', requireRole('super_admin', 'admin'), stockOpnameController.cancel)

module.exports = router