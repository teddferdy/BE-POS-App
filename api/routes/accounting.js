const express = require('express')
const router = express.Router()
const accountingController = require('../controller/accounting')
const authorization = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

router.get('/accounts', authorization, validateStoreAccess, accountingController.listAccounts)
router.post('/accounts', authorization, validateStoreAccess, accountingController.createAccount)
router.put('/accounts/:id', authorization, validateStoreAccess, accountingController.updateAccount)
router.delete('/accounts/:id', authorization, validateStoreAccess, accountingController.deleteAccount)

router.get('/journals', authorization, validateStoreAccess, accountingController.listJournals)
router.post('/journals', authorization, validateStoreAccess, accountingController.createManualJournal)
router.delete('/journals/:id', authorization, validateStoreAccess, accountingController.deleteJournal)

router.get('/trial-balance', authorization, validateStoreAccess, accountingController.getTrialBalance)
router.get('/income-statement', authorization, validateStoreAccess, accountingController.getIncomeStatement)
router.get('/balance-sheet', authorization, validateStoreAccess, accountingController.getBalanceSheet)

module.exports = router
