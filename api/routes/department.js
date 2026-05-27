const express = require('express')
const router = express.Router()

const departmentController = require('../controller/department')
const authorization = require('../../utils/authorization')

router.get('/get-department', departmentController.getAllDepartment)

router.get(
  '/get-department-all',
  authorization,
  departmentController.getAllDepartmentInTable
)

router.post(
  '/add-new-department',
  authorization,
  departmentController.addNewDepartment
)

router.put(
  '/edit-department/:id',
  authorization,
  departmentController.editDepartmentById
)

router.delete(
  '/delete-department/:id',
  authorization,
  departmentController.deleteDepartmentById
)

module.exports = router
