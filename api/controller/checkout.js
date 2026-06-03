const db = require('../../db/models')
const Checkout = db.checkout
const Transaction = db.transaction
const BestSelling = db.best_selling
const Member = db.member
const MemberTier = db.member_tier
const { createNotification } = require('../../utils/createNotification')
const { createAudit } = require('../../utils/auditLog')

exports.addNewTransaction = async (id, order) => {
  for (const element of order) {
    await Transaction.create({
      order: id,
      typePayment: element.typePayment || 'cash',
      amount: element.price || 0,
      createdBy: element.createdBy || null
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
        totalPrice: body.totalPrice,
        store: body.store,
        cashierName: body.cashierName,
        totalQuantity: body.totalQuantity,
        typePayment: body.typePayment,
        createdBy: body.createdBy
      })

      if (body.customerPhoneNumber) {
        try {
          const member = await Member.findOne({ where: { phoneNumber: body.customerPhoneNumber, store: body.store } })
          if (member) {
            const tier = member.tier ? await MemberTier.findByPk(member.tier) : null
            const multiplier = tier?.pointMultiplier || 1
            const pointsEarned = Math.floor((Number(body.totalPrice) || 0) / 1000 * Number(multiplier))
            if (pointsEarned > 0) {
              await member.update({
                totalPoints: (member.totalPoints || 0) + pointsEarned,
                lifetimePoints: (member.lifetimePoints || 0) + pointsEarned
              })
            }
          }
        } catch (err) {
          console.error('Error updating member points:', err)
        }
      }

      createAudit(req, 'create', 'checkout', creadtedCheckout.id, `Created checkout: ${creadtedCheckout.id}`)

      if (creadtedCheckout?.getDataValue) {
        createNotification({ type: 'payment_received', store: body.store, referenceId: creadtedCheckout.id, referenceType: 'checkout', params: [invoice, body.totalPrice] }).catch(console.error)

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

    createAudit(req, 'update', 'checkout', body.id, `Updated checkout: ${body.id}`)

    createNotification({ type: 'payment_received', store: body.store, referenceId: body.id, referenceType: 'checkout', params: [body.invoice, body.totalPrice] }).catch(console.error)

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
      createAudit(req, 'delete', 'checkout', body.id, `Deleted checkout: ${body.id}`)

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