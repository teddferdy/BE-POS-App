const db = require('../../db/models')
const Checkout = db.checkout
const Order = db.order
const OrderItem = db.order_item
const PaymentMethod = db.payment_method
const Transaction = db.transaction
const BestSelling = db.best_selling
const Member = db.member
const MemberTier = db.member_tier
const Product = db.product
const { createNotification } = require('../../utils/createNotification')
const { createAudit } = require('../../utils/auditLog')
const batchService = require('../service/batchService')

exports.addNewTransaction = async (id, order) => {
  for (const element of order) {
    await Transaction.create({
      order: id,
      typePayment: element.typePayment || 'cash',
      amount: element.price || 0,
      createdBy: element.createdBy || null
    })
  }

  const t = await db.sequelize.transaction()
  try {
    for (let index = 0; index < order.length; index++) {
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

      const prod = await db.product.findByPk(order[index].idProduct, {
        transaction: t
      })
      if (prod) {
        // Check BOM — if exists, deduct ingredient stock instead of product stock
        const bom = await db.bom_header.findOne({
          where: { productId: order[index].idProduct, status: 'active' },
          include: [{ model: db.bom_line, as: 'lines' }],
          transaction: t
        })

        if (bom) {
          for (const line of bom.lines) {
            const ing = await db.ingredient.findByPk(line.ingredientId, {
              transaction: t
            })
            if (!ing) continue
            const deductQty = line.qty * Number(order[index].count)
            const oldIngStock = Number(ing.stock) || 0
            if (oldIngStock < deductQty) {
              throw new Error(
                `Stok bahan "${ing.name}" tidak mencukupi untuk ${prod.nameProduct || 'produk'}: tersedia ${oldIngStock}, dibutuhkan ${deductQty}`
              )
            }
            const qty = Math.floor(Number(deductQty)) || 0
            const newIngStock = Math.max(oldIngStock - qty, 0)
            await ing.update(
              { stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`) },
              { transaction: t }
            )
            await db.stock_history.create(
              {
                ingredient: ing.id,
                ingredientName: ing.name,
                store: order[index].store,
                referenceType: 'sale',
                referenceId: id,
                quantityBefore: oldIngStock,
                quantityChange: -(oldIngStock - newIngStock),
                quantityAfter: newIngStock,
                unit: line.unit || ing.unit || 'pcs',
                notes: `Penjualan: ${prod.nameProduct || 'produk'}`,
                createdBy: order[index].createdBy || null
              },
              { transaction: t }
            )
          }
        } else {
          const oldStock = Number(prod.stock) || 0
          const qty = Math.floor(Number(order[index].count)) || 0
          const newStock = oldStock - qty
          if (newStock < 0) {
            throw new Error(
              `Stok tidak mencukupi untuk ${prod.nameProduct || 'produk'}: tersedia ${oldStock}, dibutuhkan ${order[index].count}`
            )
          }
          await prod.update(
            { stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`) },
            { transaction: t }
          )

          // ponytail: atomic upsert + deduct per-store stock
          if (order[index].store) {
            await db.sequelize.query(
              `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
               VALUES ($1, $2, 0, NOW(), NOW())
               ON CONFLICT (product, store) DO NOTHING`,
              {
                bind: [order[index].idProduct, order[index].store],
                transaction: t
              }
            )
            await db.product_store_stock.update(
              { stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`) },
              {
                where: {
                  product: order[index].idProduct,
                  store: order[index].store
                },
                transaction: t
              }
            )

            // ponytail: FIFO - consume oldest batches first
            await batchService.deductFifo({
              productId: order[index].idProduct,
              store: order[index].store,
              qty,
              transaction: t
            })
          }

          await db.stock_history.create(
            {
              product: order[index].idProduct,
              store: order[index].store,
              referenceType: 'sale',
              referenceId: id,
              quantityBefore: oldStock,
              quantityChange: -Number(order[index].count),
              quantityAfter: newStock,
              unit: prod.unit || 'pcs',
              notes: `Penjualan: ${prod.nameProduct || 'produk'}`,
              createdBy: order[index].createdBy || null
            },
            { transaction: t }
          )
        }
      }
    }
    await t.commit()
  } catch (error) {
    await t.rollback()
    throw error
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
        typePayment: body.typePayment
      })

      if (body.customerPhoneNumber) {
        try {
          const member = await Member.findOne({
            where: { phoneNumber: body.customerPhoneNumber, store: body.store }
          })
          if (member) {
            const tier = member.tier
              ? await MemberTier.findByPk(member.tier)
              : null
            const multiplier = tier?.pointMultiplier || 1
            const pointsEarned = Math.floor(
              ((Number(body.totalPrice) || 0) / 1000) * Number(multiplier)
            )
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

      createAudit(
        req,
        'create',
        'checkout',
        creadtedCheckout.id,
        `Created checkout: ${creadtedCheckout.id}`
      )

      if (creadtedCheckout?.getDataValue) {
        createNotification({
          type: 'payment_received',
          store: body.store,
          referenceId: creadtedCheckout.id,
          referenceType: 'checkout',
          params: [invoice, body.totalPrice],
          createdBy: req.user?.fullName || 'System'
        }).catch(console.error)

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
  const checkoutId = req.params.id

  try {
    await this.addNewTransaction(checkoutId, body?.order)

    const editCheckout = await Checkout?.update(
      {
        cashierName: body.cashierName,
        customerName: body.customerName,
        customerPhoneNumber: body.customerPhoneNumber,
        dateOrder: body.dateOrder,
        invoice: body.invoice,
        totalPrice: body.totalPrice,
        totalQuantity: body.totalQuantity,
        typePayment: body.typePayment
      },
      {
        returning: true,
        where: {
          id: checkoutId,
          invoice: body.invoice,
          store: body.store
        }
      }
    ).then(([_, data]) => {
      return data
    })

    createAudit(
      req,
      'update',
      'checkout',
      checkoutId,
      `Updated checkout: ${checkoutId}`
    )

    createNotification({
      type: 'payment_received',
      store: body.store,
      referenceId: checkoutId,
      referenceType: 'checkout',
      params: [body.invoice, body.totalPrice],
      createdBy: req.user?.fullName || 'System'
    }).catch(console.error)

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
  const checkoutId = req.params.id

  try {
    const getId = await Checkout.destroy({
      where: {
        id: checkoutId,
        invoice: body.invoice,
        store: body.store
      }
    })

    if (getId) {
      createAudit(
        req,
        'delete',
        'checkout',
        checkoutId,
        `Deleted checkout: ${checkoutId}`
      )

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
