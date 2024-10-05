const express = require('express')
const router = express.Router()

const roleController = require('../controller/role')
// Authorization
const authorization = require('../../utils/authorization')

// Get All role
router.get('/get-role', roleController?.getAllRole)

// Get All List To Table
router.get('/get-role-all', authorization, roleController?.getAllRoleInTable)

// Add role
router.post('/add-new-role', authorization, roleController?.addNewRole)

// Edit role
router.put('/edit-role/:id', authorization, roleController?.editRoleById)

// Delete role
router.delete('/delete-role/:id', authorization, roleController?.deleteRoleById)

module.exports = router
