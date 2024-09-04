const express = require('express')

const router = express.Router()
const whatsappClient = require('../service/whatsappClient')

// Post New Product

router.post('/message', (req, res) => {
  whatsappClient.sendMessage(req.body.phoneNumber, req.body.message)
  res.send()
})

module.exports = router
