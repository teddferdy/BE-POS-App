/* eslint-disable no-unused-vars */
const Checkout = require('../../db/models/checkout')
const Transaction = require('../../db/models/transaction')
const BestSelling = require('../../db/models/best_selling')

// Add Transaction DB
exports.addNewTransaction = async (id, order) => {
  order.forEach((element) => {
    Transaction.create({
      masterId: id,
      productId: element.idProduct,
      quantityPerProduct: element.count,
      productName: element.orderName,
      price: element.price
    })
  })

  for (let index = 0; index < order.length; index++) {
    try {
      const findBestSelling = await BestSelling?.findOne({
        where: {
          productId: order[index].idProduct,
          nameProduct: order[index].orderName
        }
      })

      console.log('findBestSelling =>', findBestSelling)

      if (findBestSelling?.dataValues) {
        await BestSelling.update(
          {
            totalSelling:
              Number(findBestSelling.dataValues.totalSelling) +
              Number(order[index].count)
          },
          {
            where: {
              productId: order[index].idProduct,
              nameProduct: order[index].orderName
            }
          }
        )
      } else {
        await BestSelling.create({
          productId: order[index].idProduct,
          nameProduct: order[index].orderName,
          image: order[index].image,
          totalSelling: Number(order[index].count)
        })
      }
    } catch (error) {
      console.log(error)

      // return res.status(500).json({
      //   error: 'Terjadi Kesalahan Internal Server'
      // })
    }
  }
}

// Generate Invoice
exports.generateInvoice = async (req, res, next) => {
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
  const chara = randomString
  const invoice = `${INV}${subStringCompName}#${timeStampDate}#${chara}`
  if (invoice) {
    return invoice
  }
}

// Post Checkout
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

      if (creadtedCheckout?.getDataValue) {
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

// Edit Checkout
exports.editCheckout = async (req, res, next) => {
  const body = req.body

  try {
    await this.addNewTransaction(body.id, body?.order)

    const editCheckout = await Checkout?.update(
      {
        cashierName: body.cashierName,
        customerName: body.customerName,
        customerPhoneNumber: body.customerPhoneNumber,
        dateOrder: body.dateOrder,
        invoice: body.invoice,
        totalPrice: body.totalPrice,
        totalQuantity: body.totalQuantity,
        typePayment: body.typePayment,
        createdBy: body.cashierName,
        modifiedBy: body?.modifiedBy
      },
      {
        returning: true,
        where: {
          id: body.id,
          invoice: body.invoice
        }
      }
    ).then(([_, data]) => {
      return data
    })

    return res.status(200).json({
      message: 'Sukses Ubah Discount',
      data: editCheckout?.dataValues
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Delete Checkout
exports.deleteCheckout = async (req, res, next) => {
  const body = req.body

  try {
    const getId = await Checkout.destroy({
      where: {
        id: body.id,
        invoice: body.invoice
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        message: 'Success Hapus Items'
      })
    } else {
      return res.status(403).json({
        message: 'Hapus Items Gagal'
      })
    }
  } catch (error) {
    console.log('ERROR =>', error)
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}
