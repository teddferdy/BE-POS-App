const express = require('express')
const router = express.Router()
const memberTierController = require('../controller/memberTier')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')

router.get('/get-all', authorization, memberTierController.getAll)
router.get('/detail/:id', authorization, memberTierController.getDetail)
router.post('/add', authorization, requireRole('super_admin', 'admin'), memberTierController.create)
router.put('/edit/:id', authorization, requireRole('super_admin', 'admin'), memberTierController.update)
router.delete('/delete/:id', authorization, requireRole('super_admin', 'admin'), memberTierController.delete)
router.get('/get-by-points', authorization, memberTierController.getMemberTier)
router.post(
  '/update-members',
  authorization,
  requireRole('super_admin', 'admin'),
  memberTierController.updateMemberTier
)

module.exports = router
