const db = require('../../db/models')
const { Op } = require('sequelize')
const ExcelJS = require('exceljs')
const { createAudit } = require('../../utils/auditLog')
const batchService = require('../service/batchService')

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
      const effectiveStore = req.storeId
      const {
        status,
        startDate,
        endDate,
        search,
        deleted,
        source,
        page = 1,
        limit = 10
      } = req.query

      const where = {}
      if (deleted) where.deletedAt = { [Op.ne]: null }
      if (status) {
        const statuses = status
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        if (statuses.length === 1) where.status = statuses[0]
        else if (statuses.length > 1) where.status = { [Op.in]: statuses }
      }
      if (source === 'goods_request') {
        where[Op.and] = db.sequelize.literal(
          'EXISTS (SELECT 1 FROM goods_request gr WHERE gr."purchaseOrderId" = "purchase_order"."id" AND gr."deletedAt" IS NULL)'
        )
      } else if (source === 'manual') {
        where[Op.and] = db.sequelize.literal(
          'NOT EXISTS (SELECT 1 FROM goods_request gr WHERE gr."purchaseOrderId" = "purchase_order"."id" AND gr."deletedAt" IS NULL)'
        )
      }
      if (startDate || endDate) {
        where.orderDate = {}
        if (startDate) where.orderDate[Op.gte] = new Date(startDate)
        if (endDate) where.orderDate[Op.lte] = new Date(endDate)
      }
      if (search) {
        where[Op.or] = [{ orderNumber: { [Op.iLike]: `%${search}%` } }]
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

      const poIds = allPOs.map((p) => p.id)
      const paymentAggs =
        poIds.length > 0
          ? await db.purchase_payment.findAll({
              attributes: [
                'purchaseOrder',
                [
                  db.sequelize.fn('SUM', db.sequelize.col('amount')),
                  'totalPaid'
                ]
              ],
              where: { deletedAt: null, purchaseOrder: poIds },
              group: ['purchaseOrder'],
              raw: true
            })
          : []

      const paidMap = {}
      paymentAggs.forEach((p) => {
        paidMap[p.purchaseOrder] = Number(p.totalPaid)
      })

      let unpaid = 0,
        partial = 0,
        paid = 0
      allPOs.forEach((po) => {
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
            ],
            [
              db.Sequelize.literal(`(
                SELECT STRING_AGG(DISTINCT s.name, ', ' ORDER BY s.name)
                FROM purchase_order_item poi
                JOIN supplier s ON s.id = poi.supplier AND s."deletedAt" IS NULL
                WHERE poi."purchaseOrder" = "purchase_order"."id"
                  AND poi."deletedAt" IS NULL
              )`),
              'supplierNames'
            ],
            [
              db.Sequelize.literal(`(
                SELECT 1
                FROM goods_request gr
                WHERE gr."purchaseOrderId" = "purchase_order"."id"
                  AND gr."deletedAt" IS NULL
                LIMIT 1
              )`),
              'isFromGoodsRequest'
            ]
          ]
        },
        include: [
          {
            model: db.user,
            as: 'picData',
            attributes: ['id', 'fullName']
          },
          {
            model: db.user,
            as: 'createdByUser',
            attributes: ['id', 'fullName', 'userName']
          },
          {
            model: db.location,
            as: 'storeData',
            attributes: ['id', 'name']
          },
          {
            model: db.purchase_order_item,
            as: 'items',
            attributes: [
              'id',
              'ingredientName',
              'quantity',
              'price',
              'unit',
              'supplier'
            ],
            include: [
              {
                model: db.supplier,
                as: 'supplierData',
                attributes: ['id', 'name']
              }
            ]
          }
        ],
        order: [['updatedAt', 'DESC']],
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
      const store = req.storeId

      const where = { id }
      if (store) where.store = store

      const purchaseOrder = await db.purchase_order.findOne({
        where,
        include: [
          {
            model: db.user,
            as: 'picData',
            attributes: ['id', 'fullName']
          },
          {
            model: db.user,
            as: 'createdByUser',
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
              },
              {
                model: db.supplier,
                as: 'supplierData',
                attributes: ['id', 'name', 'phone']
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
            where: { purchaseOrder: id, status: { [Op.ne]: 'rejected' } },
            attributes: []
          }
        ],
        attributes: [
          'ingredient',
          'product',
          'ingredientName',
          [
            db.Sequelize.fn(
              'COALESCE',
              db.Sequelize.fn('SUM', db.Sequelize.col('qty')),
              0
            ),
            'returnedQty'
          ]
        ],
        group: ['ingredient', 'product', 'ingredientName'],
        raw: true
      })

      const returnMap = {}
      returnAgg.forEach((r) => {
        const key = r.ingredient
          ? `ing-${r.ingredient}`
          : r.product
            ? `prod-${r.product}`
            : r.ingredientName
              ? `name-${r.ingredientName}`
              : null
        if (key) returnMap[key] = parseFloat(r.returnedQty) || 0
      })

      const data = purchaseOrder.toJSON()
      if (data.items) {
        data.items = data.items.map((item) => ({
          ...item,
          returnedQty: item.ingredient
            ? returnMap[`ing-${item.ingredient}`] || 0
            : item.product
              ? returnMap[`prod-${item.product}`] || 0
              : item.ingredientName
                ? returnMap[`name-${item.ingredientName}`] || 0
                : 0
        }))
      }

      const supplierNames = [
        ...new Set(
          (data.items || [])
            .map((item) => item.supplierData?.name)
            .filter(Boolean)
        )
      ]
      data.supplierNames = supplierNames

      if (!data.picData) {
        const safePoId = String(purchaseOrder.id).trim()
        const goodsRequest = await db.goodsRequest.findOne({ // codacy-ignore-line
          where: { purchaseOrderId: safePoId },
          attributes: ['requestedBy']
        })
        if (goodsRequest?.requestedBy) {
          data.picData = { id: null, fullName: goodsRequest.requestedBy }
        }
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

  async sendToSupplier(req, res) {
    try {
      const { id } = req.params
      const store = req.storeId

      const where = { id }
      if (store) where.store = store

      const po = await db.purchase_order.findOne({ where })

      if (!po) {
        return res.status(404).json({
          success: false,
          message: 'Purchase order not found'
        })
      }

      if (po.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Only pending PO can be sent to supplier. Current status: ${po.status}`
        })
      }

      await po.update({
        status: 'ordered',
        modifiedBy: req.user?.id || null
      })

      await createAudit(
        req,
        'update',
        'purchase_order',
        id,
        'Sent PO to supplier: ' + id
      )

      return res.status(200).json({
        success: true,
        message: 'Purchase order sent to supplier',
        data: po
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
      const {
        items,
        discount = 0,
        notes,
        orderDate,
        pic,
        dueDate,
        status,
        paymentMethod,
        tenor,
        dpPercent,
        additionalCost = 0,
        overDeliveryTolerance = 10
      } = req.body
      const createdBy = req.user?.id || null
      const store = req.storeId

      const isDraft = status === 'draft'

      if (!isDraft) {
        if (!items || items.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Items are required'
          })
        }

        if (paymentMethod === 'credit' && !dueDate) {
          return res.status(400).json({
            success: false,
            message: 'Tanggal jatuh tempo wajib diisi'
          })
        }

        // reject duplicate ingredient/product + supplier combos in same PO
        const keys = items
          .map((i) => {
            const base = i.ingredient
              ? `ing-${i.ingredient}`
              : i.product
                ? `prod-${i.product}`
                : null
            return base && i.supplier ? `${base}-sup-${i.supplier}` : base
          })
          .filter(Boolean)
        const dupes = keys.filter((k, i) => keys.indexOf(k) !== i)
        if (dupes.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Duplicate item(s) in purchase order: ${[...new Set(dupes)].join(', ')}`
          })
        }
      }

      const orderNumber = generateOrderNumber('PO')

      const totalAmount =
        items?.length > 0
          ? items.reduce((sum, item) => sum + item.quantity * item.price, 0)
          : 0

      const finalAmount = totalAmount - discount + (Number(additionalCost) || 0)

      const purchaseOrder = await db.purchase_order.create({
        store: store || null,
        orderNumber,
        totalAmount,
        discount,
        finalAmount,
        status: status || 'pending',
        orderDate: orderDate || new Date(),
        notes,
        createdBy,
        pic: pic || null,
        dueDate,
        paymentMethod: paymentMethod || 'cash',
        tenor: tenor || 0,
        dpPercent: dpPercent || 0,
        additionalCost: Number(additionalCost) || 0,
        overDeliveryTolerance: Number(overDeliveryTolerance) || 10
      })

      if (items?.length > 0) {
        const orderItems = items.map((item) => ({
          purchaseOrder: purchaseOrder.id,
          product: item.product || null,
          ingredient: item.ingredient || null,
          ingredientName: item.ingredientName || null,
          supplier: item.supplier || null,
          quantity: item.quantity,
          unit: item.unit || 'pcs',
          price: item.price,
          total: item.quantity * item.price,
          receivedQuantity: 0,
          conversionToBase: Number(item.conversionToBase) || 1
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
      const { store: requestedStore, ...bodyRest } = req.body
      const {
        items,
        discount,
        status,
        notes,
        orderDate,
        pic,
        dueDate,
        paymentMethod,
        tenor,
        dpPercent,
        additionalCost,
        overDeliveryTolerance
      } = bodyRest
      const modifiedBy = req.user?.id || null
      const userRole = req.user?.roleType
      const userStore = req.user?.store

      // Super admin may move the PO to any store; other roles are always
      // scoped to their own store (validateStoreAccess already guards this).
      const where = { id }
      if (userRole !== 'super_admin' && req.storeId) where.store = req.storeId

      const purchaseOrder = await db.purchase_order.findOne({
        where
      })

      if (!purchaseOrder) {
        return res.status(404).json({
          success: false,
          message: 'Purchase order not found'
        })
      }

      // Only super admin may change the store of an existing PO
      let finalStore
      if (requestedStore !== undefined) {
        finalStore =
          userRole === 'super_admin' ? requestedStore : userStore || null
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

      const effectivePaymentMethod =
        paymentMethod ?? purchaseOrder.paymentMethod
      if (
        dueDate !== undefined &&
        !dueDate &&
        effectivePaymentMethod === 'credit'
      ) {
        return res.status(400).json({
          success: false,
          message: 'Tanggal jatuh tempo wajib diisi'
        })
      }

      // reject duplicate ingredient/product + supplier combos in same PO
      if (items) {
        const keys = items
          .map((i) => {
            const base = i.ingredient
              ? `ing-${i.ingredient}`
              : i.product
                ? `prod-${i.product}`
                : null
            return base && i.supplier ? `${base}-sup-${i.supplier}` : base
          })
          .filter(Boolean)
        const dupes = keys.filter((k, i) => keys.indexOf(k) !== i)
        if (dupes.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Duplicate item(s) in purchase order: ${[...new Set(dupes)].join(', ')}`
          })
        }
      }

      let totalAmount = purchaseOrder.totalAmount
      if (items) {
        // Preserve receivedQuantity from existing items before destroying
        const existingItems = await db.purchase_order_item.findAll({
          where: { purchaseOrder: id }
        })
        const receivedMap = {}
        existingItems.forEach((ei) => {
          const base = ei.ingredient
            ? `ing-${ei.ingredient}`
            : ei.product
              ? `prod-${ei.product}`
              : `id-${ei.id}`
          const key = base && ei.supplier ? `${base}-sup-${ei.supplier}` : base
          receivedMap[key] = Number(ei.receivedQuantity) || 0
        })

        await db.purchase_order_item.destroy({
          where: { purchaseOrder: id }
        })

        const orderItems = items.map((item) => {
          const base = item.ingredient
            ? `ing-${item.ingredient}`
            : item.product
              ? `prod-${item.product}`
              : null
          const key =
            base && item.supplier ? `${base}-sup-${item.supplier}` : base
          return {
            purchaseOrder: id,
            product: item.product || null,
            ingredient: item.ingredient || null,
            ingredientName: item.ingredientName || null,
            supplier: item.supplier || null,
            quantity: item.quantity,
            unit: item.unit || 'pcs',
            price: item.price,
            total: item.quantity * item.price,
            receivedQuantity:
              key && receivedMap[key] !== undefined ? receivedMap[key] : 0,
            conversionToBase: Number(item.conversionToBase) || 1
          }
        })

        await db.purchase_order_item.bulkCreate(orderItems)

        totalAmount = items.reduce((sum, item) => {
          return sum + item.quantity * item.price
        }, 0)
      }

      const finalDiscount =
        discount !== undefined ? discount : purchaseOrder.discount
      const finalAdditionalCost =
        additionalCost !== undefined
          ? Number(additionalCost) || 0
          : Number(purchaseOrder.additionalCost) || 0
      const finalAmount = totalAmount - finalDiscount + finalAdditionalCost

      await purchaseOrder.update({
        totalAmount,
        discount: finalDiscount,
        finalAmount,
        status: status || purchaseOrder.status,
        notes: notes !== undefined ? notes : purchaseOrder.notes,
        orderDate: orderDate || purchaseOrder.orderDate,
        modifiedBy,
        pic: pic !== undefined ? pic : purchaseOrder.pic,
        dueDate: dueDate !== undefined ? dueDate : purchaseOrder.dueDate,
        paymentMethod:
          paymentMethod !== undefined
            ? paymentMethod
            : purchaseOrder.paymentMethod,
        tenor: tenor !== undefined ? tenor : purchaseOrder.tenor,
        dpPercent:
          dpPercent !== undefined ? dpPercent : purchaseOrder.dpPercent,
        additionalCost: finalAdditionalCost,
        overDeliveryTolerance:
          overDeliveryTolerance !== undefined
            ? Number(overDeliveryTolerance) || 10
            : purchaseOrder.overDeliveryTolerance || 10,
        ...(finalStore !== undefined ? { store: finalStore } : {})
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
      const store = req.storeId || req.cookies.store
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

      if (purchaseOrder.paymentMethod === 'credit') {
        const dpAmount =
          (Number(purchaseOrder.dpPercent || 0) / 100) *
          Number(purchaseOrder.finalAmount || 0)
        const paidToPO =
          (await db.purchase_payment.sum('amount', {
            where: { purchaseOrder: id, deletedAt: null }
          })) || 0
        if (paidToPO < dpAmount) {
          return res.status(400).json({
            success: false,
            message: `DP belum lunas. DP: Rp ${dpAmount.toLocaleString('id-ID')}, Dibayar: Rp ${paidToPO.toLocaleString('id-ID')}`
          })
        }
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

            const maxReceive =
              Number(poItem.quantity) - Number(poItem.receivedQuantity)
            const receiveQty = Math.min(
              Number(item.receivedQuantity) || 0,
              maxReceive
            )

            await db.purchase_order_item.update(
              {
                receivedQuantity: db.sequelize.literal(
                  `receivedQuantity + ${receiveQty}`
                )
              },
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

                // ponytail: atomic upsert + add per-store stock
                if (store) {
                  await db.sequelize.query(
                    `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
                     VALUES ($1, $2, 0, NOW(), NOW())
                     ON CONFLICT (product, store) DO NOTHING`,
                    { bind: [item.product, store], transaction }
                  )
                  await db.product_store_stock.update(
                    { stock: db.sequelize.literal(`stock + ${receiveQty}`) },
                    {
                      where: { product: item.product, store },
                      transaction
                    }
                  )

                  // ponytail: FIFO - create a batch per received line
                  await batchService.addBatchStock({
                    productId: item.product,
                    store,
                    qty: receiveQty,
                    costPerUnit:
                      Number(item.price) || Number(poItem.price) || 0,
                    batchCode: `${purchaseOrder.orderNumber}-${poItem.id || item.id}`,
                    receivedDate: receivedDate || new Date(),
                    transaction
                  })
                }
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
                    ingredient: ingredient.id,
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
          (pi) => Number(pi.receivedQuantity) >= Number(pi.quantity)
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
      const store = req.storeId

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
      const store = req.storeId || req.cookies.store

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

              // Reverse receivedQuantity on PO item
              if (grItem.purchaseOrderItem) {
                await db.purchase_order_item.update(
                  {
                    receivedQuantity: db.sequelize.literal(
                      `GREATEST("receivedQuantity" - ${qty}, 0)`
                    )
                  },
                  {
                    where: { id: grItem.purchaseOrderItem, purchaseOrder: id },
                    transaction: t
                  }
                )
              } else if (grItem.ingredientName) {
                // Match PO item by ingredient name and reverse receivedQuantity
                const poItem = await db.purchase_order_item.findOne({
                  where: {
                    purchaseOrder: id,
                    ingredientName: grItem.ingredientName
                  },
                  transaction: t
                })
                if (poItem) {
                  await poItem.update(
                    {
                      receivedQuantity: db.sequelize.literal(
                        `GREATEST("receivedQuantity" - ${qty}, 0)`
                      )
                    },
                    { transaction: t }
                  )
                }
              }

              // Reverse product stock
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
                  if (purchaseOrder.store) {
                    await db.sequelize.query(
                      `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
                       VALUES ($1, $2, 0, NOW(), NOW())
                       ON CONFLICT (product, store) DO NOTHING`,
                      {
                        bind: [grItem.product, purchaseOrder.store],
                        transaction: t
                      }
                    )
                    await db.product_store_stock.update(
                      {
                        stock: db.sequelize.literal(
                          `GREATEST(stock - ${qty}, 0)`
                        )
                      },
                      {
                        where: {
                          product: grItem.product,
                          store: purchaseOrder.store
                        },
                        transaction: t
                      }
                    )
                  }
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

              // Reverse ingredient stock
              if (grItem.ingredientName) {
                const ingredient = await db.ingredient.findOne({
                  where: {
                    name: grItem.ingredientName,
                    store: purchaseOrder.store
                  },
                  transaction: t
                })
                if (ingredient) {
                  const qtyBefore = Number(ingredient.stock) || 0
                  await ingredient.update(
                    { stock: Math.max(qtyBefore - qty, 0) },
                    { transaction: t }
                  )
                  await db.stock_history.create(
                    {
                      ingredient: ingredient.id,
                      ingredientName: ingredient.name,
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
      const store = req.storeId
      const where = {}
      if (store) where.store = store

      const orders = await db.purchase_order.findAll({
        where,
        include: [
          {
            model: db.purchase_order_item,
            as: 'items',
            include: [
              { model: db.supplier, as: 'supplierData', attributes: ['name'] }
            ]
          }
        ],
        order: [['createdAt', 'ASC']]
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

      orders.forEach((o) => {
        const supplierNames = [
          ...new Set(
            (o.items || [])
              .map((item) => item.supplierData?.name)
              .filter(Boolean)
          )
        ].join(', ')
        worksheet.addRow([
          o.orderNumber,
          supplierNames || 'Unknown',
          o.totalAmount,
          o.discount,
          o.finalAmount,
          o.status,
          o.orderDate ? o.orderDate.toISOString().split('T')[0] : '',
          o.createdAt ? o.createdAt.toISOString() : ''
        ])
      })

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
            store: req.storeId || req.cookies.store || req.user?.store
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
      const supplierCache = {}
      for (const data of ordersToCreate) {
        // Resolve supplier name to ID
        let supplierId = null
        if (data.supplier) {
          const trimmedName = data.supplier.trim()
          const cacheKey = `${trimmedName}-${data.store || ''}`
          if (supplierCache[cacheKey]) {
            supplierId = supplierCache[cacheKey]
          } else {
            const supplierObj = await db.supplier.findOne({
              where: {
                name: { [Op.iLike]: trimmedName },
                store: data.store || null
              }
            })
            if (supplierObj) {
              supplierId = supplierObj.id
              supplierCache[cacheKey] = supplierId
            }
          }
        }

        const order = await db.purchase_order.create({
          store: data.store,
          orderNumber: generateOrderNumber('PO'),
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
          supplier: supplierId,
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
        data: {
          total: ordersToCreate.length,
          created: createdOrders.length
        }
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
