const db = require('../../db/models')
const Checkout = db.checkout
const Transaction = db.transaction
const BestSelling = db.best_selling

exports.addNewTransaction = async (id, order) => {
  for (const element of order) {
    await Transaction.create({
      masterId: id,
      productId: element.idProduct,
      quantityPerProduct: element.count,
      productName: element.orderName,
      price: element.price,
      store: element.store
    })
  }

  for (let index = 0; index < order.length; index++) {
    try {
      const findBestSelling = await BestSelling?.findOne({
        where: {
          productId: order[index].idProduct,
          nameProduct: order[index].orderName,
          store: order[index].store
        }
      })

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
          image: order[index].img,
          totalSelling: Number(order[index].count),
          store: order[index].store
        })
      }
    } catch (error) {
      console.error(error)
    }
  }
}

exports.generateInvoice = async () => {
  const COMP_NAME = 'BISA NOTA'
  const date = new Date()
  const lengthChara = 5
  const charSet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let randomString = ''

  for (let i = 0; i < lengthChara; i++) {
    const randomPoz = Math.floor(Math.random() * charSet.length)
    randomString += charSet.substring(randomPoz, randomPoz + 1)
  }

  const INV = 'INV'
  const subStringCompName = COMP_NAME.substring(0, 3)
  const timeStampDate = date.getTime()
  const chara = randomString
  const invoice = `${INV}${subStringCompName}#${timeStampDate}#${chara}`
  return invoice
}

exports.checkout = async (req, res) => {
  const body = req.body
  const invoice = await this.generateInvoice()

  try {
    const findOneCheckout = await Checkout?.findOne({
      where: {
        invoice: invoice,
        store: body.store
      }
    })

    if (!findOneCheckout?.getDataValue) {
      const creadtedCheckout = await Checkout.create({
        invoice: invoice,
        dateOrder: new Date(),
        dateCheckout: new Date(),
        totalPrice: body.totalPrice,
        store: body.store,
        cashierName: body.cashierName,
        totalQuantity: body.totalQuantity,
        createdBy: body.createdBy
      })

      if (creadtedCheckout?.getDataValue) {
        return res.status(200).json({
          success: true,
          message: 'Success',
          data: creadtedCheckout.dataValues
        })
      }
    }
    return res.status(403).json({
      success: false,
      message: 'Location Sudah Terdaftar'
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.editCheckout = async (req, res) => {
  const body = req.body

  try {
    await this.addNewTransaction(body.id, body?.order)

    const editCheckout = await Checkout?.update(
      {
        cashierName: body.cashierName,
        customerName: body.customerName,
        customerPhoneNumber: body.customerPhoneNumber,
        dateOrder: body.dateOrder,
        dateCheckout: body.dateCheckout,
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
          invoice: body.invoice,
          store: body.store
        }
      }
    ).then(([_, data]) => {
      return data
    })

    return res.status(200).json({
      success: true,
      message: 'Sukses Ubah Checkout',
      data: editCheckout?.dataValues
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.deleteCheckout = async (req, res) => {
  const body = req.body

  try {
    const getId = await Checkout.destroy({
      where: {
        id: body.id,
        invoice: body.invoice,
        store: body.store
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        success: true,
        message: 'Success Hapus Items'
      })
    }
    return res.status(403).json({
      success: false,
      message: 'Hapus Items Gagal'
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}