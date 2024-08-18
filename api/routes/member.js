const express = require('express')
const router = express.Router()

const memberController = require('../controller/member')

// Authorization
const authorization = require('../../utils/authorization')

router.get('/get-member', authorization, memberController?.getAllMember)

router.post('/add-new-member', authorization, memberController?.addNewMember)

router.put(
  '/edit-point-member/:phoneNumber',
  authorization,
  memberController.editMemberById
)

module.exports = router
