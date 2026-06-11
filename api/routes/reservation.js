const express = require('express')
const router = express.Router()
const reservationController = require('../controller/reservation')
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get('/', authorization, validateStoreAccess, reservationController.getAll)
router.get('/available-tables/list', authorization, validateStoreAccess, reservationController.getAvailableTables)
router.get('/:id', authorization, validateStoreAccess, reservationController.getById)

router.post('/', authorization, validateStoreAccess, reservationController.create)
router.put('/:id', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), reservationController.update)
router.delete('/:id', authorization, validateStoreAccess, requireRole('super_admin', 'admin'), reservationController.remove)

module.exports = router
