const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')

const generateReceiptNo = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const timestamp = Date.now()
  return `GR-${year}${month}${day}-${timestamp}`
}

const goodsReceiptController = {
  async getAll(req, res) {
    try {
      const { store } = req.cookies
      const userRole = req.user?.roleType
      const {
        page = 1,
        limit = 10,
        status,
        poId,
        startDate,
        endDate
      } = req.query

      const where = {}
      if (store && userRole !== 'super_admin') where.store = store
      if (status) where.status = status
      if (poId) where.purchaseOrderId = poId
      if (startDate || endDate) {
        where.receivedDate = {}
        if (startDate) where.receivedDate[Op.gte] = new Date(startDate)
        if (endDate) where.receivedDate[Op.lte] = new Date(endDate)
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const { count, rows } = await db.goodsReceipt.findAndCountAll({
        where,
        include: [
          {
            model: db.purchase_order,
            as: 'purchaseOrderData',
            attributes: ['id', 'orderNumber', 'status']
          },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] },
          { model: db.goodsReceiptItem, as: 'items' }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      const stats = {
        total: count,
        draft: await db.goodsReceipt.count({
          where: { ...where, status: 'draft' }
        }),
        completed: await db.goodsReceipt.count({
          where: { ...where, status: 'completed' }
        }),
        cancelled: await db.goodsReceipt.count({
          where: { ...where, status: 'cancelled' }
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success',
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        },
        stats
      })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies
      const userRole = req.user?.roleType

      const where = { id }
      if (store && userRole !== 'super_admin') where.store = store

      const receipt = await db.goodsReceipt.findOne({
        where,
        include: [
          {
            model: db.purchase_order,
            as: 'purchaseOrderData',
            attributes: ['id', 'orderNumber', 'status']
          },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] },
          {
            model: db.goodsReceiptItem,
            as: 'items',
            include: [
              {
                model: db.product,
                as: 'productData',
                attributes: ['id', 'nameProduct']
              }
            ]
          }
        ]
      })

      if (!receipt) {
        return res
          .status(404)
          .json({ success: false, message: 'Goods receipt not found' })
      }

      let poItems = []
      if (receipt.purchaseOrderId) {
        poItems = await db.purchase_order_item.findAll({
          where: { purchaseOrder: receipt.purchaseOrderId }
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success',
        data: {
          ...receipt.toJSON(),
          purchaseOrderItems: poItems
        }
      })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getByPO(req, res) {
    try {
      const { poId } = req.params
      const { store } = req.cookies
      const userRole = req.user?.roleType

      const where = { purchaseOrderId: poId }
      if (store && userRole !== 'super_admin') where.store = store

      const receipts = await db.goodsReceipt.findAll({
        where,
        include: [
          { model: db.goodsReceiptItem, as: 'items' },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
        ],
        order: [['createdAt', 'DESC']]
      })

      return res.status(200).json({
        success: true,
        message: 'Success',
        data: receipts
      })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async create(req, res) {
    try {
      const { store } = req.cookies
      const { purchaseOrderId, items, receivedDate, notes } = req.body

      if (!purchaseOrderId || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Purchase order and items are required'
        })
      }

      const po = await db.purchase_order.findOne({
        where: { id: purchaseOrderId, store }
      })

      if (!po) {
        return res
          .status(404)
          .json({ success: false, message: 'Purchase order not found' })
      }

      if (po.status === 'cancelled') {
        return res
          .status(400)
          .json({ success: false, message: 'Cannot receive cancelled order' })
      }

      const receiptNumber = generateReceiptNo()
      const effectiveStore = store || po.store

      const transaction = await db.sequelize.transaction()

      try {
        const receipt = await db.goodsReceipt.create(
          {
            store: effectiveStore,
            receiptNumber,
            purchaseOrderId,
            receivedDate: receivedDate || new Date(),
            status: 'completed',
            notes,
            createdBy: req.user?.id || null
          },
          { transaction }
        )

        const receiptItems = []
        for (const item of items) {
          const qty = parseInt(item.qtyReceived) || 0
          if (qty <= 0) continue

          receiptItems.push({
            goodsReceipt: receipt.id,
            purchaseOrderItem: item.purchaseOrderItem || null,
            product: item.product || null,
            qtyReceived: qty,
            unit: item.unit || 'pcs',
            conditionNotes: item.conditionNotes || null
          })

          if (item.purchaseOrderItem) {
            await db.purchase_order_item.update(
              {
                receivedQuantity: db.sequelize.literal(
                  `receivedQuantity + ${qty}`
                )
              },
              {
                where: {
                  id: item.purchaseOrderItem,
                  purchaseOrder: purchaseOrderId
                }
              },
              { transaction }
            )
          }

          if (item.product) {
            const product = await db.product.findByPk(item.product, {
              transaction
            })
            if (product) {
              const qtyBefore = Number(product.stock) || 0
              await product.update({ stock: qtyBefore + qty }, { transaction })

              await db.stock_history.create(
                {
                  product: item.product,
                  store: effectiveStore,
                  referenceType: 'purchase',
                  quantityBefore: qtyBefore,
                  quantityChange: qty,
                  quantityAfter: qtyBefore + qty,
                  unit: item.unit || 'pcs',
                  notes: `GR: ${receiptNumber} (PO: ${po.orderNumber})`,
                  createdBy: req.user?.id || null
                },
                { transaction }
              )
            }
          }

          if (item.ingredientName) {
            const ingredient = await db.ingredient.findOne({
              where: { name: { [Op.iLike]: item.ingredientName.trim() } },
              transaction
            })

            if (ingredient) {
              const qtyBefore = Number(ingredient.stock) || 0
              await ingredient.update(
                { stock: qtyBefore + qty },
                { transaction }
              )

              await db.stock_history.create(
                {
                  ingredientName: ingredient.name,
                  store: effectiveStore,
                  referenceType: 'purchase',
                  quantityBefore: qtyBefore,
                  quantityChange: qty,
                  quantityAfter: qtyBefore + qty,
                  unit: item.unit || ingredient.unit || 'pcs',
                  notes: `GR: ${receiptNumber} (PO: ${po.orderNumber})`,
                  createdBy: req.user?.id || null
                },
                { transaction }
              )
            }
          }
        }

        if (receiptItems.length > 0) {
          await db.goodsReceiptItem.bulkCreate(receiptItems, { transaction })
        }

        const allPoItems = await db.purchase_order_item.findAll({
          where: { purchaseOrder: purchaseOrderId },
          transaction
        })

        const allReceived = allPoItems.every(
          (pi) => Number(pi.receivedQuantity) >= Number(pi.quantity)
        )

        if (allReceived) {
          await po.update(
            { status: 'received', receivedDate: receivedDate || new Date() },
            { transaction }
          )
        } else {
          await po.update({ status: 'ordered' }, { transaction })
        }

        await transaction.commit()

        const created = await db.goodsReceipt.findByPk(receipt.id, {
          include: [{ model: db.goodsReceiptItem, as: 'items' }]
        })

        await createAudit(
          req,
          'create',
          'goods_receipt',
          receipt.id,
          'Created goods_receipt: ' + receipt.id
        )

        return res.status(201).json({
          success: true,
          message: 'Success create goods receipt',
          data: created
        })
      } catch (err) {
        await transaction.rollback()
        throw err
      }
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies
      const userRole = req.user?.roleType
      const { notes } = req.body

      const where = { id }
      if (store && userRole !== 'super_admin') where.store = store

      const receipt = await db.goodsReceipt.findOne({ where })
      if (!receipt) {
        return res
          .status(404)
          .json({ success: false, message: 'Goods receipt not found' })
      }

      if (receipt.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: 'Only draft receipt can be updated'
        })
      }

      await receipt.update({
        notes: notes !== undefined ? notes : receipt.notes,
        modifiedBy: req.user?.id || null
      })

      return res.status(200).json({
        success: true,
        message: 'Success update goods receipt',
        data: receipt
      })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies
      const userRole = req.user?.roleType

      const where = { id }
      if (store && userRole !== 'super_admin') where.store = store

      const receipt = await db.goodsReceipt.findOne({ where })
      if (!receipt) {
        return res
          .status(404)
          .json({ success: false, message: 'Goods receipt not found' })
      }

      if (receipt.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: 'Only draft receipt can be deleted'
        })
      }

      await db.goodsReceiptItem.destroy({ where: { goodsReceipt: id } })
      await receipt.destroy()

      await createAudit(
        req,
        'delete',
        'goods_receipt',
        id,
        'Deleted goods_receipt: ' + id
      )

      return res
        .status(200)
        .json({ success: true, message: 'Success delete goods receipt' })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async changeStatus(req, res) {
    try {
      const { id } = req.params
      const { status } = req.body
      const { store } = req.cookies
      const userRole = req.user?.roleType

      if (!['completed', 'cancelled'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be "completed" or "cancelled"'
        })
      }

      const where = { id }
      if (store && userRole !== 'super_admin') where.store = store

      const receipt = await db.goodsReceipt.findOne({ where })
      if (!receipt) {
        return res
          .status(404)
          .json({ success: false, message: 'Goods receipt not found' })
      }

      if (receipt.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: `Cannot change status from "${receipt.status}"`
        })
      }

      await receipt.update({
        status,
        modifiedBy: req.user?.id || null,
        receivedDate: status === 'completed' ? new Date() : receipt.receivedDate
      })

      await createAudit(
        req,
        'update',
        'goods_receipt',
        id,
        'Changed goods_receipt status to ' + status + ': ' + id
      )

      return res.status(200).json({
        success: true,
        message: `Status changed to "${status}"`,
        data: receipt
      })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  }
}

module.exports = goodsReceiptController
