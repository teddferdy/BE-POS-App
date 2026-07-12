const db = require('../../db/models')
const { Op } = require('sequelize')
const ExcelJS = require('exceljs')
const { createAudit } = require('../../utils/auditLog')

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
      const userRole = req.user?.roleType
      const effectiveStore = userRole === 'super_admin' ? (req.query.store || req.cookies.store) : req.cookies.store
      const {
        status,
        supplier,
        startDate,
        endDate,
        search,
        page = 1,
        limit = 10
      } = req.query

      const where = {}
      if (effectiveStore) where.store = effectiveStore
      if (status) where.status = status
      if (supplier) where.supplier = supplier
      if (startDate || endDate) {
        where.orderDate = {}
        if (startDate) where.orderDate[Op.gte] = new Date(startDate)
        if (endDate) where.orderDate[Op.lte] = new Date(endDate)
      }
      if (search) {
        where[Op.or] = [
          { orderNumber: { [Op.iLike]: `%${search}%` } },
          { '$supplierData.name$': { [Op.iLike]: `%${search}%` } }
        ]
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const statsWhere = effectiveStore ? { store: effectiveStore } : {}
      const [
        draftCount,
        pendingCount,
        orderedCount,
        receivedCount,
        cancelledCount
      ] = await Promise.all([
        db.purchase_order.count({ where: { ...statsWhere, status: 'draft' } }),
        db.purchase_order.count({
          where: { ...statsWhere, status: 'pending' }
        }),
        db.purchase_order.count({
          where: { ...statsWhere, status: 'ordered' }
        }),
        db.purchase_order.count({
          where: { ...statsWhere, status: 'received' }
        }),
        db.purchase_order.count({
          where: { ...statsWhere, status: 'cancelled' }
        })
      ])
      const stats = {
        draft: draftCount,
        pending: pendingCount,
        ordered: orderedCount,
        received: receivedCount,
        cancelled: cancelledCount
      }

      // ponytail: JS-side aggregation, raw SQL was hard to maintain
      const allPOs = await db.purchase_order.findAll({
        where: { ...statsWhere, status: { [Op.ne]: 'draft' } },
        attributes: ['id', 'finalAmount']
      })

      const poIds = allPOs.map(p => p.id)
      const paymentAggs = poIds.length > 0 ? await db.purchase_payment.findAll({
        attributes: [
          'purchaseOrder',
          [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'totalPaid']
        ],
        where: { deletedAt: null, purchaseOrder: poIds },
        group: ['purchaseOrder'],
        raw: true
      }) : []

      const paidMap = {}
      paymentAggs.forEach(p => { paidMap[p.purchaseOrder] = Number(p.totalPaid) })

      let unpaid = 0, partial = 0, paid = 0
      allPOs.forEach(po => {
        const tp = paidMap[po.id] || 0
        if (tp === 0) unpaid++
        else if (tp < Number(po.finalAmount)) partial++
        else paid++
      })

      const paymentStats = { unpaid, partial, paid }

      const { count, rows } = await db.purchase_order.findAndCountAll({
        where,
        attributes: {
          include: [
            [
              db.Sequelize.literal(`(
                SELECT COALESCE(SUM(amount), 0)
                FROM purchase_payment
                WHERE "purchase_payment"."purchaseOrder" = "purchase_order"."id"
                  AND "purchase_payment"."deletedAt" IS NULL
              )`),
              'totalPaid'
            ]
          ]
        },
        include: [
          {
            model: db.supplier,
            as: 'supplierData',
            attributes: ['id', 'name', 'phone']
          },
          {
            model: db.user,
            as: 'picData',
            attributes: ['id', 'fullName']
          },
          {
            model: db.location,
            as: 'storeData',
            attributes: ['id', 'name']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset,
        distinct: true
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
        },
        stats,
        paymentStats
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

      const where = { id }
      if (store) where.store = store

      const purchaseOrder = await db.purchase_order.findOne({
        where,
        include: [
          {
            model: db.supplier,
            as: 'supplierData',
            attributes: ['id', 'name', 'phone', 'email', 'address']
          },
          {
            model: db.user,
            as: 'picData',
            attributes: ['id', 'fullName']
          },
          {
            model: db.location,
            as: 'storeData',
            attributes: ['id', 'name']
          },
          {
            model: db.purchase_order_item,
            as: 'items',
            include: [
              {
                model: db.product,
                as: 'productData',
                attributes: ['id', 'nameProduct']
              },
              {
                model: db.ingredient,
                as: 'ingredientData',
                attributes: ['id', 'name', 'unit']
              }
            ]
          },
          {
            model: db.purchase_payment,
            as: 'payments',
            attributes: [
              'id',
              'amount',
              'paymentDate',
              'paymentMethod',
              'reference',
              'notes'
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

      const returnAgg = await db.purchase_return_item.findAll({
        include: [
          {
            model: db.purchase_return,
            as: 'return',
            where: { purchaseOrder: id },
            attributes: []
          }
        ],
        attributes: [
          'ingredient',
          'product',
          [
            db.Sequelize.fn(
              'COALESCE',
              db.Sequelize.fn('SUM', db.Sequelize.col('qty')),
              0
            ),
            'returnedQty'
          ]
        ],
        group: ['ingredient', 'product'],
        raw: true
      })

      const returnMap = {}
      returnAgg.forEach((r) => {
        const key = r.ingredient ? `ing-${r.ingredient}` : `prod-${r.product}`
        returnMap[key] = parseFloat(r.returnedQty) || 0
      })

      const data = purchaseOrder.toJSON()
      if (data.items) {
        data.items = data.items.map((item) => ({
          ...item,
          returnedQty: item.ingredient
            ? returnMap[`ing-${item.ingredient}`] || 0
            : item.product
              ? returnMap[`prod-${item.product}`] || 0
              : 0
        }))
      }

      return res.status(200).json({
        success: true,
        message: 'Success get purchase order',
        data
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
      const { store: bodyStore } = req.body
      const userRole = req.user?.roleType
      const store = userRole === 'super_admin' ? (bodyStore || req.cookies.store) : (req.cookies.store || bodyStore)
      const {
        supplier,
        items,
        discount = 0,
        notes,
        orderDate,
        pic,
        dueDate,
        status
      } = req.body
      const createdBy = req.user?.id || null

      const isDraft = status === 'draft'

      if (!isDraft) {
        if (!supplier || !items || items.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Supplier and items are required'
          })
        }

        if (!dueDate) {
          return res.status(400).json({
            success: false,
            message: 'Tanggal jatuh tempo wajib diisi'
          })
        }
      }

      const orderNumber = generateOrderNumber('PO')

      const totalAmount =
        items?.length > 0
          ? items.reduce((sum, item) => sum + item.quantity * item.price, 0)
          : 0

      const finalAmount = totalAmount - discount

      const purchaseOrder = await db.purchase_order.create({
        store: store || null,
        orderNumber,
        supplier: supplier || null,
        totalAmount,
        discount,
        finalAmount,
        status: status || 'pending',
        orderDate: orderDate || new Date(),
        notes,
        createdBy,
        pic: pic || null,
        dueDate
      })

      if (items?.length > 0) {
        const orderItems = items.map((item) => ({
          purchaseOrder: purchaseOrder.id,
          product: item.product || null,
          ingredient: item.ingredient || null,
          ingredientName: item.ingredientName || null,
          quantity: item.quantity,
          unit: item.unit || 'pcs',
          price: item.price,
          total: item.quantity * item.price,
          receivedQuantity: 0
        }))

        await db.purchase_order_item.bulkCreate(orderItems)
      }

      const createdOrder = await db.purchase_order.findOne({
        where: { id: purchaseOrder.id },
        include: [
          {
            model: db.purchase_order_item,
            as: 'items'
          }
        ]
      })

      await createAudit(
        req,
        'create',
        'purchase_order',
        purchaseOrder.id,
        'Created purchase_order: ' + purchaseOrder.id
      )

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
      const {
        supplier,
        items,
        discount,
        status,
        notes,
        orderDate,
        pic,
        dueDate
      } = req.body
      const modifiedBy = req.user?.id || null

      const where = { id }
      if (store) where.store = store

      const purchaseOrder = await db.purchase_order.findOne({
        where
      })

      if (!purchaseOrder) {
        return res.status(404).json({
          success: false,
          message: 'Purchase order not found'
        })
      }

      if (
        purchaseOrder.status === 'received' ||
        purchaseOrder.status === 'cancelled'
      ) {
        return res.status(400).json({
          success: false,
          message: 'Cannot update received or cancelled purchase order'
        })
      }

      if (dueDate !== undefined && !dueDate) {
        return res.status(400).json({
          success: false,
          message: 'Tanggal jatuh tempo wajib diisi'
        })
      }

      let totalAmount = purchaseOrder.totalAmount
      if (items) {
        await db.purchase_order_item.destroy({
          where: { purchaseOrder: id }
        })

        const orderItems = items.map((item) => ({
          purchaseOrder: id,
          product: item.product || null,
          ingredient: item.ingredient || null,
          ingredientName: item.ingredientName || null,
          quantity: item.quantity,
          unit: item.unit || 'pcs',
          price: item.price,
          total: item.quantity * item.price,
          receivedQuantity: 0
        }))

        await db.purchase_order_item.bulkCreate(orderItems)

        totalAmount = items.reduce((sum, item) => {
          return sum + item.quantity * item.price
        }, 0)
      }

      const finalDiscount =
        discount !== undefined ? discount : purchaseOrder.discount
      const finalAmount = totalAmount - finalDiscount

      await purchaseOrder.update({
        supplier: supplier || purchaseOrder.supplier,
        totalAmount,
        discount: finalDiscount,
        finalAmount,
        status: status || purchaseOrder.status,
        notes: notes !== undefined ? notes : purchaseOrder.notes,
        orderDate: orderDate || purchaseOrder.orderDate,
        modifiedBy,
        pic: pic !== undefined ? pic : purchaseOrder.pic,
        dueDate: dueDate !== undefined ? dueDate : purchaseOrder.dueDate
      })

      await createAudit(
        req,
        'update',
        'purchase_order',
        id,
        'Updated purchase_order: ' + id
      )

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

      const where = { id }
      if (store) where.store = store

      const purchaseOrder = await db.purchase_order.findOne({
        where,
        include: [{ model: db.purchase_order_item, as: 'items' }]
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

      if (purchaseOrder.status === 'received') {
        return res.status(400).json({
          success: false,
          message: 'Purchase order already fully received'
        })
      }

      const transaction = await db.sequelize.transaction()

      try {
        if (items && items.length > 0) {
          // Build a lookup of existing PO items by their DB id
          const poItems = purchaseOrder.items.reduce((map, pi) => {
            map[pi.id] = pi
            return map
          }, {})

          for (const item of items) {
            const poItem = poItems[item.id]
            if (!poItem) continue

            const maxReceive = Number(poItem.quantity) - Number(poItem.receivedQuantity)
            const receiveQty = Math.min(Number(item.receivedQuantity) || 0, maxReceive)

            await db.purchase_order_item.update(
              { receivedQuantity: db.sequelize.literal(`receivedQuantity + ${receiveQty}`) },
              { where: { id: item.id, purchaseOrder: id }, transaction }
            )

            if (item.product) {
              const product = await db.product.findByPk(item.product, {
                transaction
              })
              if (product) {
                const quantityBefore = product.stock

                await db.stock_history.create(
                  {
                    store,
                    product: item.product,
                    referenceType: 'purchase',
                    referenceId: id,
                    quantityBefore,
                    quantityChange: receiveQty,
                    quantityAfter: quantityBefore + receiveQty,
                    unit: item.unit || 'pcs',
                    createdBy: req.user?.id
                  },
                  { transaction }
                )

                await product.update(
                  { stock: product.stock + receiveQty },
                  { transaction }
                )
              }
            }

            if (item.ingredient || item.ingredientName) {
              const ingredient = item.ingredient
                ? await db.ingredient.findByPk(item.ingredient, { transaction })
                : await db.ingredient.findOne({
                    where: { name: item.ingredientName, store },
                    transaction
                  })

              if (ingredient) {
                const quantityBefore = ingredient.stock
                await db.stock_history.create(
                  {
                    store,
                    ingredientName: ingredient.name,
                    referenceType: 'purchase',
                    referenceId: id,
                    quantityBefore,
                    quantityChange: receiveQty,
                    quantityAfter: quantityBefore + receiveQty,
                    unit: item.unit || 'pcs',
                    createdBy: req.user?.id
                  },
                  { transaction }
                )
                await ingredient.update(
                  { stock: ingredient.stock + receiveQty },
                  { transaction }
                )
              }
            }
          }
        }

        // Re-fetch items to check if all are fully received
        const updatedItems = await db.purchase_order_item.findAll({
          where: { purchaseOrder: id },
          transaction
        })
        const allReceived = updatedItems.every(
          pi => Number(pi.receivedQuantity) >= Number(pi.quantity)
        )

        await purchaseOrder.update(
          {
            status: allReceived ? 'received' : 'ordered',
            receivedDate: receivedDate || new Date()
          },
          { transaction }
        )

        await transaction.commit()

        await createAudit(
          req,
          'update',
          'purchase_order',
          id,
          'Received purchase_order: ' + id
        )

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

  async delete(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies

      const where = { id }
      if (store) where.store = store

      const purchaseOrder = await db.purchase_order.findOne({
        where
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
          message: 'Cannot delete received order, use cancel instead'
        })
      }

      await db.purchase_order_item.destroy({
        where: { purchaseOrder: id }
      })

      await purchaseOrder.destroy()

      await createAudit(
        req,
        'delete',
        'purchase_order',
        id,
        'Deleted purchase_order: ' + id
      )

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
  },

  async cancel(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies

      const where = { id }
      if (store) where.store = store

      const purchaseOrder = await db.purchase_order.findOne({
        where,
        include: [{ model: db.purchase_order_item, as: 'items' }]
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
          message: 'Purchase order is already cancelled'
        })
      }

      if (purchaseOrder.status === 'received') {
        const grs = await db.goodsReceipt.findAll({
          where: { purchaseOrderId: id, status: 'completed' },
          include: [{ model: db.goodsReceiptItem, as: 'items' }]
        })

        const t = await db.sequelize.transaction()
        try {
          for (const gr of grs) {
            for (const grItem of gr.items) {
              const qty = parseInt(grItem.qtyReceived) || 0
              if (qty <= 0) continue

              if (grItem.purchaseOrderItem) {
                await db.purchase_order_item.update(
                  {
                    receivedQuantity: db.sequelize.literal(
                      `GREATEST(receivedQuantity - ${qty}, 0)`
                    )
                  },
                  {
                    where: { id: grItem.purchaseOrderItem, purchaseOrder: id },
                    transaction: t
                  }
                )
              }

              if (grItem.product) {
                const product = await db.product.findByPk(grItem.product, {
                  transaction: t
                })
                if (product) {
                  const qtyBefore = Number(product.stock) || 0
                  await product.update(
                    { stock: Math.max(qtyBefore - qty, 0) },
                    { transaction: t }
                  )
                  await db.stock_history.create(
                    {
                      product: grItem.product,
                      store: purchaseOrder.store,
                      referenceType: 'adjustment',
                      quantityBefore: qtyBefore,
                      quantityChange: -qty,
                      quantityAfter: Math.max(qtyBefore - qty, 0),
                      unit: grItem.unit || 'pcs',
                      notes: `PO cancel: ${purchaseOrder.orderNumber}`,
                      createdBy: req.user?.id || null
                    },
                    { transaction: t }
                  )
                }
              }
            }

            await gr.update(
              { status: 'cancelled', modifiedBy: req.user?.id || null },
              { transaction: t }
            )
          }

          await purchaseOrder.update(
            { status: 'cancelled', modifiedBy: req.user?.id || null },
            { transaction: t }
          )
          await t.commit()
        } catch (err) {
          await t.rollback()
          throw err
        }
      } else {
        await purchaseOrder.update({
          status: 'cancelled',
          modifiedBy: req.user?.id || null
        })
      }

      await createAudit(
        req,
        'update',
        'purchase_order',
        id,
        'Cancelled purchase_order: ' + id
      )

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

  async downloadTemplate(req, res) {
    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Purchase Order Template')

      worksheet.addRow([
        'Supplier Name',
        'Product/Item',
        'Quantity',
        'Unit',
        'Price',
        'Notes'
      ])

      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      }

      worksheet.columns = [
        { width: 25 },
        { width: 30 },
        { width: 15 },
        { width: 10 },
        { width: 15 },
        { width: 30 }
      ]

      const buffer = await workbook.xlsx.writeBuffer()

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=po-template.xlsx'
      )

      return res.status(200).send(buffer)
    } catch (error) {
      console.error('Error =>', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async downloadData(req, res) {
    try {
      const { store } = req.cookies
      const where = {}
      if (store) where.store = store

      const orders = await db.purchase_order.findAll({
        where,
        include: [
          { model: db.supplier, as: 'supplierData', attributes: ['name'] },
          { model: db.purchase_order_item, as: 'items' }
        ],
        order: [['createdAt', 'DESC']]
      })

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Purchase Orders')

      worksheet.addRow([
        'Order No',
        'Supplier',
        'Total Amount',
        'Discount',
        'Final Amount',
        'Status',
        'Order Date',
        'Created At'
      ])
      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      }

      orders.forEach((o) =>
        worksheet.addRow([
          o.orderNumber,
          o.supplierData?.name || o.supplier,
          o.totalAmount,
          o.discount,
          o.finalAmount,
          o.status,
          o.orderDate ? o.orderDate.toISOString().split('T')[0] : '',
          o.createdAt ? o.createdAt.toISOString() : ''
        ])
      )

      worksheet.columns = [
        { width: 20 },
        { width: 25 },
        { width: 15 },
        { width: 10 },
        { width: 15 },
        { width: 12 },
        { width: 15 },
        { width: 20 }
      ]

      const buffer = await workbook.xlsx.writeBuffer()

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=purchase-orders.xlsx'
      )

      return res.status(200).send(buffer)
    } catch (error) {
      console.error('Error =>', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async importData(req, res) {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: 'No file uploaded' })
      }

      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(req.file.buffer)
      const worksheet = workbook.getWorksheet(1)

      const ordersToCreate = []
      const errors = []

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return

        try {
          const [supplierName, productItem, quantity, unit, price, notes] =
            row.values

          if (!supplierName || !productItem || !quantity || !price) {
            errors.push(
              `Row ${rowNumber}: Supplier, product, quantity and price are required`
            )
            return
          }

          ordersToCreate.push({
            supplier: supplierName.trim(),
            items: [
              {
                product: null,
                ingredientName: productItem.trim(),
                quantity: parseFloat(quantity),
                unit: (unit || 'pcs').trim(),
                price: parseFloat(price)
              }
            ],
            notes: notes?.trim() || null,
            store: req.cookies.store || req.user?.store
          })
        } catch (error) {
          errors.push(`Row ${rowNumber}: ${error.message}`)
        }
      })

      if (errors.length > 0) {
        return res
          .status(400)
          .json({ success: false, message: 'Validation errors', errors })
      }

      const createdOrders = []
      for (const data of ordersToCreate) {
        const order = await db.purchase_order.create({
          store: data.store,
          orderNumber: generateOrderNumber('PO'),
          supplier: data.supplier,
          totalAmount: data.items.reduce((s, i) => s + i.quantity * i.price, 0),
          discount: 0,
          finalAmount: data.items.reduce((s, i) => s + i.quantity * i.price, 0),
          status: 'draft',
          orderDate: new Date(),
          notes: data.notes,
          createdBy: req.user?.id || null
        })
        const orderItems = data.items.map((item) => ({
          purchaseOrder: order.id,
          product: item.product || null,
          ingredient: item.ingredient || null,
          ingredientName: item.ingredientName || null,
          quantity: item.quantity,
          unit: item.unit || 'pcs',
          price: item.price,
          total: item.quantity * item.price,
          receivedQuantity: 0
        }))
        await db.purchase_order_item.bulkCreate(orderItems)
        createdOrders.push(order)
      }

      await createAudit(
        req,
        'import',
        'purchase_order',
        null,
        'Imported purchase_order from file'
      )

      return res.status(200).json({
        success: true,
        message: `Imported ${createdOrders.length} purchase orders`,
        data: createdOrders
      })
    } catch (error) {
      console.error('Error =>', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  }
}

module.exports = purchaseOrderController
