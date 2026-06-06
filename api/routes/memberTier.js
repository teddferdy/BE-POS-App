const express = require('express')
const router = express.Router()
const memberTierController = require('../controller/memberTier')
const authorization = require('../../utils/authorization')

router.get('/get-all', authorization, memberTierController.getAll)
router.post('/add', authorization, memberTierController.create)
router.put('/edit/:id', authorization, memberTierController.update)
router.delete('/delete/:id', authorization, memberTierController.delete)
router.get('/get-by-points', authorization, memberTierController.getMemberTier)
router.post(
  '/update-members',
  authorization,
  memberTierController.updateMemberTier
)

module.exports = router
