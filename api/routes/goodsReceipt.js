const express = require('express')
const router = express.Router()
const goodsReceiptController = require('../controller/goodsReceipt')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')
const { validate } = require('../middleware/validate')
const { createGoodsReceiptSchema, updateGoodsReceiptSchema } = require('../validation/schemas')

router.get(
  '/get-all',
  authorization,
  validateStoreAccess,
  goodsReceiptController.getAll
)
router.get(
  '/get-by-id/:id',
  authorization,
  validateStoreAccess,
  goodsReceiptController.getById
)
router.get(
  '/by-po/:poId',
  authorization,
  validateStoreAccess,
  goodsReceiptController.getByPO
)
router.get(
  '/export',
  authorization,
  validateStoreAccess,
  goodsReceiptController.exportExcel
)

router.post(
  '/create',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(createGoodsReceiptSchema),
  goodsReceiptController.create
)
router.put(
  '/update/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  validate(updateGoodsReceiptSchema),
  goodsReceiptController.update
)
router.delete(
  '/delete/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  goodsReceiptController.delete
)

router.patch(
  '/status/:id',
  authorization,
  validateStoreAccess,
  requireRole('super_admin', 'admin'),
  goodsReceiptController.changeStatus
)

module.exports = router
