/* eslint-disable no-unused-vars */
const Checkout = require('../../db/models/checkout')

// Generate Invoice
exports.generateInvoice = async (req, res, next) => {
  /*
    INV[company_name]#[transaction_date]#[random_generate]
    ketentuan: 
    INV (dari kata Invoice)
    [company_name](3 first char)
    [transaction_date](timestamp)
    [random_generate](5char)

    contoh:
    INVAYA#130920241525012365#y&u>3
  */
  const COMP_NAME = 'BISA NOTA'
  const date = new Date()
  const lengthChara = 5
  const charSet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  var randomString = ''

  for (var i = 0; i < lengthChara; i++) {
    var randomPoz = Math.floor(Math.random() * charSet.length)
    randomString += charSet.substring(randomPoz, randomPoz + 1)
  }

  const INV = 'INV'

  const subStringCompName = COMP_NAME.substring(0, 3)
  const timeStampDate = date.getTime()
  console.log('timeStampDate =>', timeStampDate)

  const chara = randomString
  const invoice = `${INV}${subStringCompName}#${timeStampDate}#${chara}`
  if (invoice) {
    return invoice
  }
}

// Checkout
exports.checkout = async (req, res, next) => {
  const body = req.body

  const invoice = await this.generateInvoice()

  try {
    const findOneCheckout = await Checkout?.findOne({
      where: {
        invoice: invoice
      }
    })

    if (!findOneCheckout?.getDataValue) {
      const creadtedCheckout = await Checkout.create({
        invoice: invoice,
        dateOrder: new Date(),
        totalPrice: body.totalPrice,
        cashierName: body.cashierName,
        totalQuantity: body.totalQuantity,
        createdBy: body.createdBy
      })

      console.log('creadtedCheckout =>', creadtedCheckout)

      if (creadtedCheckout?.getDataValue) {
        console.log(
          'creadtedCheckout?.getDataValue =>',
          creadtedCheckout.dataValues
        )

        return res.status(200).json({
          message: 'Success',
          data: creadtedCheckout.dataValues
        })
      }
    } else {
      return res.status(403).json({
        message: 'Location Sudah Terdaftar'
      })
    }
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}
