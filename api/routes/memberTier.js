const express = require('express')
const router = express.Router()
const memberTierController = require('../controller/memberTier')
const authorization = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get('/get-all', authorization, validateStoreAccess, memberTierController.getAll)
router.post('/add', authorization, validateStoreAccess, memberTierController.create)
router.put('/edit/:id', authorization, validateStoreAccess, memberTierController.update)
router.delete('/delete/:id', authorization, validateStoreAccess, memberTierController.delete)
router.get('/get-by-points', authorization, validateStoreAccess, memberTierController.getMemberTier)
router.post(
  '/update-members',
  authorization, validateStoreAccess,
  memberTierController.updateMemberTier
)

module.exports = router
