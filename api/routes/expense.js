const express = require('express')
const router = express.Router()
const expenseController = require('../controller/expense')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')

// Get expenses - All authenticated users
router.get('/get-all', authorization, expenseController.getAll)
router.get('/get-by-id/:id', authorization, expenseController.getById)
router.get('/get-summary', authorization, expenseController.getSummary)

// Create/Edit/Delete expense - Admin & Super Admin only
router.post('/add', requireRole('super_admin', 'admin'), expenseController.create)
router.put('/edit/:id', requireRole('super_admin', 'admin'), expenseController.update)
router.delete('/delete/:id', requireRole('super_admin', 'admin'), expenseController.delete)

// Approve/Reject - Admin & Super Admin only
router.put('/approve/:id', requireRole('super_admin', 'admin'), expenseController.approve)
router.put('/reject/:id', requireRole('super_admin', 'admin'), expenseController.reject)

module.exports = router