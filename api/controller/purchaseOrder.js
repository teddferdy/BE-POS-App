const db = require('../../db/models')
const { Op } = require('sequelize')

const generateOrderNumber = (prefix) => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')
  return `${prefix}-${year}${month}${day}-${random}`
}

const purchaseOrderController = {
  async getAll(req, res) {
    try {
      const { store } = req.cookies
      const { status, supplier, startDate, endDate, page = 1, limit = 20 } = req.query

      const where = { store }
      if (status) where.status = status
      if (supplier) where.supplier = supplier
      if (startDate || endDate) {
        where.orderDate = {}
        if (startDate) where.orderDate[Op.gte] = new Date(startDate)
        if (endDate) where.orderDate[Op.lte] = new Date(endDate)
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const { count, rows } = await db.purchaseOrder.findAndCountAll({
        where,
        include: [
          {
            model: db.supplier,
            as: 'supplierData',
            attributes: ['id', 'name', 'phone']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      return res.status(200).json({
        success: true,
        message: 'Success get purchase orders',
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies

      const purchaseOrder = await db.purchaseOrder.findOne({
        where: { id, store },
        include: [
          {
            model: db.supplier,
            as: 'supplierData',
            attributes: ['id', 'name', 'phone', 'email', 'address']
          },
          {
            model: db.purchaseOrderItem,
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

      if (!purchaseOrder) {
        return res.status(404).json({
          success: false,
          message: 'Purchase order not found'
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success get purchase order',
        data: purchaseOrder
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async create(req, res) {
    try {
      const { store } = req.cookies
      const { supplier, items, discount = 0, notes, orderDate } = req.body
      const createdBy = req.user?.id || null

      if (!supplier || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Supplier and items are required'
        })
      }

      const orderNumber = generateOrderNumber('PO')

      const totalAmount = items.reduce((sum, item) => {
        return sum + item.quantity * item.price
      }, 0)

      const finalAmount = totalAmount - discount

      const purchaseOrder = await db.purchaseOrder.create({
        store,
        orderNumber,
        supplier,
        totalAmount,
        discount,
        finalAmount,
        status: 'pending',
        orderDate: orderDate || new Date(),
        notes,
        createdBy
      })

      const orderItems = items.map((item) => ({
        purchaseOrder: purchaseOrder.id,
        product: item.product || null,
        ingredientName: item.ingredientName || null,
        quantity: item.quantity,
        unit: item.unit || 'pcs',
        price: item.price,
        total: item.quantity * item.price,
        receivedQuantity: 0
      }))

      await db.purchaseOrderItem.bulkCreate(orderItems)

      const createdOrder = await db.purchaseOrder.findOne({
        where: { id: purchaseOrder.id },
        include: [
          {
            model: db.purchaseOrderItem,
            as: 'items'
          }
        ]
      })

      return res.status(201).json({
        success: true,
        message: 'Success create purchase order',
        data: createdOrder
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies
      const { supplier, items, discount, status, notes, orderDate } = req.body
      const modifiedBy = req.user?.id || null

      const purchaseOrder = await db.purchaseOrder.findOne({
        where: { id, store }
      })

      if (!purchaseOrder) {
        return res.status(404).json({
          success: false,
          message: 'Purchase order not found'
        })
      }

      if (purchaseOrder.status === 'received' || purchaseOrder.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Cannot update received or cancelled order'
        })
      }

      let totalAmount = purchaseOrder.totalAmount
      if (items) {
        await db.purchaseOrderItem.destroy({
          where: { purchaseOrder: id }
        })

        const orderItems = items.map((item) => ({
          purchaseOrder: id,
          product: item.product || null,
          ingredientName: item.ingredientName || null,
          quantity: item.quantity,
          unit: item.unit || 'pcs',
          price: item.price,
          total: item.quantity * item.price,
          receivedQuantity: 0
        }))

        await db.purchaseOrderItem.bulkCreate(orderItems)

        totalAmount = items.reduce((sum, item) => {
          return sum + item.quantity * item.price
        }, 0)
      }

      const finalDiscount = discount !== undefined ? discount : purchaseOrder.discount
      const finalAmount = totalAmount - finalDiscount

      await purchaseOrder.update({
        supplier: supplier || purchaseOrder.supplier,
        totalAmount,
        discount: finalDiscount,
        finalAmount,
        status: status || purchaseOrder.status,
        notes: notes !== undefined ? notes : purchaseOrder.notes,
        orderDate: orderDate || purchaseOrder.orderDate,
        modifiedBy
      })

      return res.status(200).json({
        success: true,
        message: 'Success update purchase order',
        data: purchaseOrder
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async receive(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies
      const { items, receivedDate } = req.body

      const purchaseOrder = await db.purchaseOrder.findOne({
        where: { id, store },
        include: [{ model: db.purchaseOrderItem, as: 'items' }]
      })

      if (!purchaseOrder) {
        return res.status(404).json({
          success: false,
          message: 'Purchase order not found'
        })
      }

      if (purchaseOrder.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Cannot receive cancelled order'
        })
      }

      const transaction = await db.sequelize.transaction()

      try {
        if (items && items.length > 0) {
          for (const item of items) {
            await db.purchaseOrderItem.update(
              { receivedQuantity: item.receivedQuantity },
              { where: { id: item.id, purchaseOrder: id } },
              { transaction }
            )

            if (item.product) {
              const product = await db.product.findByPk(item.product, { transaction })
              if (product) {
                const quantityBefore = product.stock
                const quantityChange = item.receivedQuantity

                await db.stockHistory.create(
                  {
                    store,
                    product: item.product,
                    referenceType: 'purchase',
                    referenceId: id,
                    quantityBefore,
                    quantityChange,
                    quantityAfter: quantityBefore + quantityChange,
                    unit: item.unit || 'pcs',
                    createdBy: req.user?.id
                  },
                  { transaction }
                )

                await product.update(
                  { stock: product.stock + item.receivedQuantity },
                  { transaction }
                )
              }
            }

            if (item.ingredientName) {
              const ingredient = await db.ingredient.findOne({
                where: { name: item.ingredientName, store },
                transaction
              })

              if (ingredient) {
                const quantityBefore = ingredient.stock

                await db.stockHistory.create(
                  {
                    store,
                    ingredientName: item.ingredientName,
                    referenceType: 'purchase',
                    referenceId: id,
                    quantityBefore,
                    quantityChange: item.receivedQuantity,
                    quantityAfter: quantityBefore + item.receivedQuantity,
                    unit: item.unit || 'pcs',
                    createdBy: req.user?.id
                  },
                  { transaction }
                )

                await ingredient.update(
                  { stock: ingredient.stock + item.receivedQuantity },
                  { transaction }
                )
              }
            }
          }
        }

        await purchaseOrder.update(
          {
            status: 'received',
            receivedDate: receivedDate || new Date()
          },
          { transaction }
        )

        await transaction.commit()

        return res.status(200).json({
          success: true,
          message: 'Success receive purchase order',
          data: purchaseOrder
        })
      } catch (err) {
        await transaction.rollback()
        throw err
      }
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async cancel(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies
      const { reason } = req.body

      const purchaseOrder = await db.purchaseOrder.findOne({
        where: { id, store }
      })

      if (!purchaseOrder) {
        return res.status(404).json({
          success: false,
          message: 'Purchase order not found'
        })
      }

      if (purchaseOrder.status === 'received') {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel received order'
        })
      }

      await purchaseOrder.update({
        status: 'cancelled',
        notes: purchaseOrder.notes
          ? `${purchaseOrder.notes}\nCancellation reason: ${reason}`
          : `Cancellation reason: ${reason}`
      })

      return res.status(200).json({
        success: true,
        message: 'Success cancel purchase order'
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies

      const purchaseOrder = await db.purchaseOrder.findOne({
        where: { id, store }
      })

      if (!purchaseOrder) {
        return res.status(404).json({
          success: false,
          message: 'Purchase order not found'
        })
      }

      if (purchaseOrder.status === 'received') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete received order'
        })
      }

      await db.purchaseOrderItem.destroy({
        where: { purchaseOrder: id }
      })

      await purchaseOrder.destroy()

      return res.status(200).json({
        success: true,
        message: 'Success delete purchase order'
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }
}

module.exports = purchaseOrderController