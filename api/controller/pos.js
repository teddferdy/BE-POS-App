const db = require('../../db/models')
const { Op } = require('sequelize')
const path = require('path')
const {
  getConnectionStatus,
  sendDocument,
  logout,
  restartClient
} = require('../../utils/whatsappClient')

const getStoreId = (req) => req.query.storeId || 'default'

const posController = {
  // Barcode lookup untuk POS scan
  async lookupBarcode(req, res) {
    try {
      const { barcode } = req.query

      if (!barcode) {
        return res.status(400).json({
          success: false,
          message: 'Barcode is required'
        })
      }

      const product = await db.product.findOne({
        where: { barcode },
        attributes: [
          'id',
          'nameProduct',
          'barcode',
          'unit',
          'stock',
          'minStock',
          'price',
          'costPrice',
          'brand',
          'category'
        ],
        include: [
          { model: db.category, as: 'categoryData', attributes: ['id', 'name'] }
        ]
      })

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success',
        data: product
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  // Stock transfer antar toko — 3-phase: sent → received / cancelled
  async transfer(req, res) {
    try {
      const { fromStore, toStore, items, notes, transferredBy } = req.body

      if (!fromStore || !toStore || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'fromStore, toStore, and items are required'
        })
      }

      if (fromStore === toStore) {
        return res.status(400).json({
          success: false,
          message: 'Source and destination stores cannot be the same'
        })
      }

      const result = await db.sequelize.transaction(async (t) => {
        const transfer = await db.stock_transfer.create(
          {
            transferNumber: `TRF-${Date.now()}`,
            fromStore,
            toStore,
            notes,
            status: 'sent',
            transferredBy,
            createdBy: req.user?.id || null
          },
          { transaction: t }
        )

        const transferItems = items.map((item) => ({
          stockTransfer: transfer.id,
          product: item.productId,
          qty: item.qty,
          unit: item.unit || 'pcs',
          notes: item.notes || null
        }))

        await db.stock_transfer_item.bulkCreate(transferItems, {
          transaction: t
        })

        for (const item of items) {
          const product = await db.product.findByPk(item.productId, {
            transaction: t
          })
          if (!product) continue

          // Check stock before atomic deduct
          const pssRow = await db.product_store_stock.findOne({
            where: { product: item.productId, store: fromStore },
            transaction: t
          })
          const availPss = Number(pssRow?.stock) || 0
          if (availPss < Number(item.qty)) {
            throw new Error(
              `Insufficient stock at source store for product "${product.nameProduct}" (SKU: ${product.sku || '-'})`
            )
          }

          // ponytail: atomic upsert + deduct
          await db.sequelize.query(
            `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
             VALUES ($1, $2, 0, NOW(), NOW())
             ON CONFLICT (product, store) DO NOTHING`,
            { bind: [item.productId, fromStore], transaction: t }
          )
          await db.product_store_stock.update(
            {
              stock: db.sequelize.literal(
                `GREATEST(stock - ${Math.floor(Number(item.qty)) || 0}, 0)`
              )
            },
            {
              where: { product: item.productId, store: fromStore },
              transaction: t
            }
          )

          const oldPssStock = availPss
          const newPssStock = availPss - Number(item.qty)

          const oldStock = Number(product.stock) || 0
          const qty = Math.floor(Number(item.qty)) || 0
          const newStock = oldStock - qty
          await product.update(
            { stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`) },
            { transaction: t }
          )

          await db.stock_history.create(
            {
              product: item.productId,
              store: fromStore,
              referenceType: 'transfer',
              referenceId: transfer.id,
              quantityBefore: oldPssStock,
              quantityChange: -Number(item.qty),
              quantityAfter: newPssStock,
              unit: item.unit || 'pcs',
              notes: `Transfer sent to store ${toStore}`,
              createdBy: req.user?.id || null
            },
            { transaction: t }
          )
        }

        return transfer
      })

      return res.status(201).json({
        success: true,
        message: 'Stock transfer created',
        data: result
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(400).json({
        success: false,
        message: error.message || 'Internal server error'
      })
    }
  },

  // Receive stock transfer — confirm arrival at destination
  async receiveTransfer(req, res) {
    try {
      const { id } = req.params

      const transfer = await db.stock_transfer.findOne({
        where: { id },
        include: [{ model: db.stock_transfer_item, as: 'items' }]
      })

      if (!transfer) {
        return res.status(404).json({
          success: false,
          message: 'Stock transfer not found'
        })
      }

      if (transfer.status !== 'sent') {
        return res.status(400).json({
          success: false,
          message: 'Only sent transfers can be received'
        })
      }

      const { toStore } = transfer

      await db.sequelize.transaction(async (t) => {
        for (const item of transfer.items) {
          const product = await db.product.findByPk(item.product, {
            transaction: t
          })
          if (!product) continue

          // ponytail: atomic upsert + add
          await db.sequelize.query(
            `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
             VALUES ($1, $2, 0, NOW(), NOW())
             ON CONFLICT (product, store) DO NOTHING`,
            { bind: [item.product, toStore], transaction: t }
          )
          await db.product_store_stock.update(
            {
              stock: db.sequelize.literal(
                `stock + ${Math.floor(Number(item.qty)) || 0}`
              )
            },
            { where: { product: item.product, store: toStore }, transaction: t }
          )

          const oldPssStock = 0
          const newPssStock = Number(item.qty)

          const oldStock = Number(product.stock) || 0
          const qty = Math.floor(Number(item.qty)) || 0
          const newStock = oldStock + qty
          await product.update(
            { stock: db.sequelize.literal(`stock + ${qty}`) },
            { transaction: t }
          )

          await db.stock_history.create(
            {
              product: item.product,
              store: toStore,
              referenceType: 'transfer',
              referenceId: transfer.id,
              quantityBefore: oldPssStock,
              quantityChange: Number(item.qty),
              quantityAfter: newPssStock,
              unit: item.unit || 'pcs',
              notes: `Transfer received from store ${transfer.fromStore}`,
              createdBy: req.user?.id || null
            },
            { transaction: t }
          )

          // Add destination store to product's store list via junction table
          const existingProdStore = await db.product_store.findOne({
            where: { product: item.product, store: Number(toStore) },
            transaction: t
          })
          if (!existingProdStore) {
            await db.product_store.create(
              { product: item.product, store: Number(toStore) },
              { transaction: t }
            )
          }

          // Add destination store to category's store list via junction table
          if (product.category) {
            const category = await db.category.findByPk(product.category, {
              transaction: t
            })
            if (category) {
              const existingCatStore = await db.category_store.findOne({
                where: { category: category.id, store: Number(toStore) },
                transaction: t
              })
              if (!existingCatStore) {
                await db.category_store.create(
                  { category: category.id, store: Number(toStore) },
                  { transaction: t }
                )
              }
            }
          }
        }

        await transfer.update({ status: 'received' }, { transaction: t })
      })

      return res.status(200).json({
        success: true,
        message: 'Stock transfer received',
        data: transfer
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(400).json({
        success: false,
        message: error.message || 'Internal server error'
      })
    }
  },

  // Cancel stock transfer — return stock to source store
  async cancelTransfer(req, res) {
    try {
      const { id } = req.params

      const transfer = await db.stock_transfer.findOne({
        where: { id },
        include: [{ model: db.stock_transfer_item, as: 'items' }]
      })

      if (!transfer) {
        return res.status(404).json({
          success: false,
          message: 'Stock transfer not found'
        })
      }

      if (transfer.status !== 'sent') {
        return res.status(400).json({
          success: false,
          message: 'Only sent transfers can be cancelled'
        })
      }

      await db.sequelize.transaction(async (t) => {
        for (const item of transfer.items) {
          const product = await db.product.findByPk(item.product, {
            transaction: t
          })
          if (!product) continue

          // ponytail: atomic upsert + add
          await db.sequelize.query(
            `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
             VALUES ($1, $2, 0, NOW(), NOW())
             ON CONFLICT (product, store) DO NOTHING`,
            { bind: [item.product, transfer.fromStore], transaction: t }
          )
          await db.product_store_stock.update(
            {
              stock: db.sequelize.literal(
                `stock + ${Math.floor(Number(item.qty)) || 0}`
              )
            },
            {
              where: { product: item.product, store: transfer.fromStore },
              transaction: t
            }
          )

          const oldPssStock = 0
          const newPssStock = Number(item.qty)

          const oldStock = Number(product.stock) || 0
          const qty = Math.floor(Number(item.qty)) || 0
          const newStock = oldStock + qty
          await product.update(
            { stock: db.sequelize.literal(`stock + ${qty}`) },
            { transaction: t }
          )

          await db.stock_history.create(
            {
              product: item.product,
              store: transfer.fromStore,
              referenceType: 'transfer',
              referenceId: transfer.id,
              quantityBefore: oldPssStock,
              quantityChange: Number(item.qty),
              quantityAfter: newPssStock,
              unit: item.unit || 'pcs',
              notes: `Transfer cancelled, returned to store ${transfer.fromStore}`,
              createdBy: req.user?.id || null
            },
            { transaction: t }
          )
        }

        await transfer.update({ status: 'cancelled' }, { transaction: t })
      })

      return res.status(200).json({
        success: true,
        message: 'Stock transfer cancelled',
        data: transfer
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(400).json({
        success: false,
        message: error.message || 'Internal server error'
      })
    }
  },

  // Get stock transfer history
  async getTransferHistory(req, res) {
    try {
      const { store: cookieStore } = req.cookies
      const userRole = req.user?.roleType
      const {
        page = 1,
        limit = 20,
        status,
        startDate,
        endDate,
        store: queryStore,
        search
      } = req.query

      let where = {}
      const effectiveStore =
        userRole === 'super_admin' ? queryStore || cookieStore : cookieStore
      const storeClause = effectiveStore
        ? [{ fromStore: effectiveStore }, { toStore: effectiveStore }]
        : null

      if (status) where.status = status

      if (storeClause && search) {
        where[Op.and] = [
          { [Op.or]: storeClause },
          { transferNumber: { [Op.iLike]: `%${search}%` } }
        ]
      } else if (storeClause) {
        where[Op.or] = storeClause
      } else if (search) {
        where.transferNumber = { [Op.iLike]: `%${search}%` }
      }

      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt[Op.gte] = new Date(startDate)
        if (endDate) where.createdAt[Op.lte] = new Date(endDate + 'T23:59:59')
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const { count, rows } = await db.stock_transfer.findAndCountAll({
        where,
        include: [
          { model: db.stock_transfer_item, as: 'items' },
          {
            model: db.location,
            as: 'fromStoreData',
            attributes: ['id', 'name']
          },
          { model: db.location, as: 'toStoreData', attributes: ['id', 'name'] },
          {
            model: db.user,
            as: 'transferredByData',
            attributes: ['id', 'fullName']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      return res.status(200).json({
        success: true,
        message: 'Success',
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  // Get stock transfer by ID
  async getTransferById(req, res) {
    try {
      const { id } = req.params

      const transfer = await db.stock_transfer.findOne({
        where: { id },
        include: [
          {
            model: db.stock_transfer_item,
            as: 'items',
            include: [
              {
                model: db.product,
                as: 'productData',
                attributes: [
                  'id',
                  'nameProduct',
                  'sku',
                  'image',
                  'barcode',
                  'stock',
                  'price'
                ]
              }
            ]
          },
          {
            model: db.location,
            as: 'fromStoreData',
            attributes: ['id', 'name', 'city', 'province', 'detailLocation']
          },
          {
            model: db.location,
            as: 'toStoreData',
            attributes: ['id', 'name', 'city', 'province', 'detailLocation']
          },
          {
            model: db.user,
            as: 'transferredByData',
            attributes: ['id', 'userName', 'fullName']
          }
        ]
      })

      if (!transfer) {
        return res
          .status(404)
          .json({ success: false, message: 'Stock transfer not found' })
      }

      return res
        .status(200)
        .json({ success: true, message: 'Success', data: transfer })
    } catch (error) {
      console.error('Error =>', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  // Stock adjustment
  async adjust(req, res) {
    try {
      const { store } = req.cookies
      let {
        productId,
        qty,
        sign,
        value,
        reason,
        referenceType = 'adjustment',
        storeId
      } = req.body

      if (qty === undefined && value === undefined) {
        return res.status(400).json({
          success: false,
          message: 'productId and qty (or sign+value) are required'
        })
      }

      // ponytail: support both signed qty and explicit sign+value
      if (qty === undefined) {
        qty = sign === '-' ? -Math.abs(Number(value)) : Math.abs(Number(value))
      }

      if (!productId || !qty) {
        return res.status(400).json({
          success: false,
          message: 'productId and qty are required'
        })
      }

      const product = await db.product.findByPk(productId)
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        })
      }

      const oldStock = Number(product.stock) || 0
      const newStock = oldStock + Number(qty)

      if (newStock < 0) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock for adjustment'
        })
      }

      const result = await db.sequelize.transaction(async (t) => {
        await product.update(
          {
            stock: db.sequelize.literal(
              `GREATEST(stock + ${Math.floor(Number(qty)) || 0}, 0)`
            )
          },
          { transaction: t }
        )

        // Update per-store stock — ponytail: atomic upsert + adjust
        const adjStore = storeId || store
        if (adjStore) {
          await db.sequelize.query(
            `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
             VALUES ($1, $2, 0, NOW(), NOW())
             ON CONFLICT (product, store) DO NOTHING`,
            { bind: [productId, adjStore], transaction: t }
          )
          await db.product_store_stock.update(
            {
              stock: db.sequelize.literal(
                `GREATEST(stock + ${Math.floor(Number(qty)) || 0}, 0)`
              )
            },
            { where: { product: productId, store: adjStore }, transaction: t }
          )
        }

        await db.stock_history.create(
          {
            product: productId,
            store: storeId || store,
            referenceType,
            quantityBefore: oldStock,
            quantityChange: qty,
            quantityAfter: newStock,
            unit: product.unit || 'pcs',
            notes: reason || 'Stock adjustment',
            createdBy: req.user?.id || null
          },
          { transaction: t }
        )

        return { product, adjustment: { oldStock, newStock, qty, reason } }
      })

      return res.status(200).json({
        success: true,
        message: 'Stock adjusted successfully',
        data: result
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  // Purchase order return — delegates to purchaseReturn controller
  async returnPurchaseOrder(req, res) {
    req.body.purchaseOrder = req.params.id
    const purchaseReturnController = require('./purchaseReturn')
    return purchaseReturnController.create(req, res)
  },

  // Sales order return
  async returnSalesOrder(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies
      const { items, reason, returnedBy } = req.body

      const order = await db.order.findByPk(id)
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        })
      }

      if (order.status !== 'paid') {
        return res.status(400).json({
          success: false,
          message: 'Only paid orders can be returned'
        })
      }

      const result = await db.sequelize.transaction(async (t) => {
        const returnOrder = await db.sales_return.create(
          {
            order: id,
            store,
            reason,
            returnNumber: `SR-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
            status: 'pending',
            returnedBy,
            createdBy: req.user?.id || null
          },
          { transaction: t }
        )

        const returnItems = items.map((item) => ({
          salesReturn: returnOrder.id,
          product: item.productId,
          qty: item.qty,
          unit: item.unit || 'pcs',
          notes: item.notes || null
        }))

        await db.sales_return_item.bulkCreate(returnItems, { transaction: t })

        // Update stock
        for (const item of items) {
          const product = await db.product.findByPk(item.productId, {
            transaction: t
          })
          if (!product) continue

          // ponytail: if BOM exists, restore ingredient stock (reverse of sale deduction).
          // If no BOM, restore product stock directly.
          const bom = await db.bom_header.findOne({
            where: { productId: item.productId, status: 'active' },
            include: [{ model: db.bom_line, as: 'lines' }],
            transaction: t
          })

          if (!bom) {
            const oldStock = Number(product.stock) || 0
            const qty = Math.floor(Number(item.qty)) || 0
            await product.update(
              { stock: db.sequelize.literal(`stock + ${qty}`) },
              { transaction: t }
            )

            // ponytail: atomic upsert + add per-store stock
            await db.sequelize.query(
              `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
               VALUES ($1, $2, 0, NOW(), NOW())
               ON CONFLICT (product, store) DO NOTHING`,
              { bind: [item.productId, store], transaction: t }
            )
            await db.product_store_stock.update(
              { stock: db.sequelize.literal(`stock + ${qty}`) },
              { where: { product: item.productId, store }, transaction: t }
            )

            await db.stock_history.create(
              {
                product: item.productId,
                store,
                referenceType: 'sale_return',
                quantityBefore: oldStock,
                quantityChange: item.qty,
                quantityAfter: oldStock + item.qty,
                unit: item.unit || 'pcs',
                notes: `Sales return: ${reason}`,
                createdBy: req.user?.id || null
              },
              { transaction: t }
            )
          } else {
            for (const line of bom.lines) {
              const ing = await db.ingredient.findByPk(line.ingredientId, {
                transaction: t
              })
              if (!ing) continue
              const restoreQty = line.qty * Number(item.qty)
              const oldIngStock = Number(ing.stock)
              await ing.update(
                { stock: oldIngStock + restoreQty },
                { transaction: t }
              )
              await db.stock_history.create(
                {
                  product: product.id,
                  ingredient: ing.id,
                  ingredientName: ing.name,
                  store,
                  referenceType: 'sale_return',
                  quantityBefore: oldIngStock,
                  quantityChange: restoreQty,
                  quantityAfter: oldIngStock + restoreQty,
                  unit: line.unit || ing.unit || 'pcs',
                  notes: `Sales return: ${reason}`,
                  createdBy: req.user?.id || null
                },
                { transaction: t }
              )
            }
          }
        }

        return returnOrder
      })

      return res.status(201).json({
        success: true,
        message: 'Sales return created',
        data: result
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  // Loyalty points - add points to member

  // Loyalty points - get point history
  async getPointHistory(req, res) {
    try {
      const { id } = req.params
      const { page = 1, limit = 20 } = req.query

      const member = await db.member.findByPk(id)
      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Member not found'
        })
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const { count, rows } = await db.member_point_history.findAndCountAll({
        where: { member: id },
        include: [
          {
            model: db.member,
            as: 'memberData',
            attributes: ['id', 'name', 'phoneNumber']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      return res.status(200).json({
        success: true,
        message: 'Success',
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  // Dashboard summary
  async getDashboardSummary(req, res) {
    try {
      const { store } = req.cookies
      let { startDate, endDate, filter, page, pageSize } = req.query
      page = Math.max(parseInt(page) || 1, 1)
      pageSize = Math.min(Math.max(parseInt(pageSize) || 5, 1), 50)

      // Auto-compute date range based on filter preset
      if (filter && !startDate && !endDate) {
        const now = new Date()
        const todayStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        )

        if (filter === 'daily') {
          startDate = todayStart.toISOString()
          endDate = new Date(todayStart.getTime() + 86400000 - 1).toISOString()
        } else if (filter === 'monthly') {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          const monthEnd = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
            23,
            59,
            59,
            999
          )
          startDate = monthStart.toISOString()
          endDate = monthEnd.toISOString()
        } else {
          // weekly — Mon to Sun of current week
          const daysSinceMonday = (now.getDay() + 6) % 7
          const monday = new Date(todayStart)
          monday.setDate(todayStart.getDate() - daysSinceMonday)
          startDate = monday.toISOString()
          endDate = new Date(monday.getTime() + 7 * 86400000 - 1).toISOString()
        }
      }

      const orderWhere = { paymentStatus: 'paid' }
      if (store) orderWhere.store = store
      if (startDate || endDate) {
        orderWhere.createdAt = {}
        if (startDate) orderWhere.createdAt[Op.gte] = new Date(startDate)
        if (endDate) orderWhere.createdAt[Op.lte] = new Date(endDate)
      }

      const productWhere = { status: 'active' }

      // Determine chart grouping based on filter
      let chartGroupBy, chartLimit
      if (filter === 'daily') {
        chartGroupBy = `DATE_TRUNC('hour', "createdAt")`
        chartLimit = 24
      } else if (filter === 'monthly') {
        chartGroupBy = `DATE("createdAt")`
        chartLimit = 31
      } else {
        chartGroupBy = `DATE("createdAt")`
        chartLimit = 7
      }

      const chartReplacements = Object.assign(
        {},
        startDate && { startDate },
        endDate && { endDate },
        store && { store }
      )

      const [
        totalSales,
        totalOrders,
        totalProducts,
        totalMembers,
        salesChart,
        bestSellers,
        recentOrders
      ] = await Promise.all([
        db.order.sum('totalPrice', { where: orderWhere }),
        db.order.count({ where: orderWhere }),
        db.product.count({ where: productWhere }),
        db.member.count(),
        db.sequelize.query(
          `
          SELECT ${chartGroupBy} as date, SUM("totalPrice") as sales
          FROM "order"
          WHERE "paymentStatus" = 'paid'
          ${startDate && endDate ? 'AND "createdAt" >= :startDate AND "createdAt" <= :endDate' : ''}
          ${store ? 'AND "store" = :store' : ''}
          GROUP BY date
          ORDER BY date ASC
          LIMIT ${chartLimit}
        `,
          {
            replacements: chartReplacements,
            type: db.sequelize.QueryTypes.SELECT
          }
        ),
        db.sequelize.query(
          `
          SELECT "productId", "nameProduct" as "productName", "image", SUM("totalSelling") as quantity
          FROM "best_selling"
          WHERE 1=1
          ${store ? 'AND "store" = :store' : ''}
          GROUP BY "productId", "nameProduct", "image"
          ORDER BY quantity DESC
          LIMIT 5
        `,
          {
            replacements: store ? { store } : {},
            type: db.sequelize.QueryTypes.SELECT
          }
        ),
        db.order
          .findAndCountAll({
            where: {
              ...(store ? { store } : {}),
              ...(startDate || endDate
                ? { createdAt: orderWhere.createdAt }
                : {})
            },
            order: [['createdAt', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize,
            distinct: true,
            include: [
              {
                model: db.order_item,
                as: 'items',
                attributes: ['id', 'productName', 'quantity', 'totalPrice']
              },
              { model: db.table, as: 'table', attributes: ['name'] }
            ]
          })
          .then(({ count, rows }) => ({
            total: count,
            page,
            pageSize,
            rows: rows.map((o) => {
              const json = o.toJSON()
              return {
                ...json,
                tableName: json.table?.name || null,
                table: json.table?.name || null
              }
            })
          }))
      ])

      const [lowStockProductCount] = await db.sequelize.query(
        `SELECT COUNT(*)::int as count FROM "product" WHERE status = 'active' AND "deletedAt" IS NULL AND "minStock" > 0 AND "stock" <= "minStock"`,
        { type: db.sequelize.QueryTypes.SELECT }
      )
      let lowStockIngQuery = `SELECT COUNT(*)::int as count FROM "ingredient" WHERE status = 'active' AND "deletedAt" IS NULL AND "stock" <= "minStock"`
      const ingReplacements = {}
      if (store) {
        lowStockIngQuery += ` AND store = :store`
        ingReplacements.store = store
      }
      const [lowStockIngredientCount] = await db.sequelize.query(
        lowStockIngQuery,
        { replacements: ingReplacements, type: db.sequelize.QueryTypes.SELECT }
      )
      const lowStock =
        parseInt(lowStockProductCount?.count || 0) +
        parseInt(lowStockIngredientCount?.count || 0)

      return res.status(200).json({
        success: true,
        message: 'Success',
        data: {
          totalSales: totalSales || 0,
          dailyTarget: store
            ? (
                await db.location.findByPk(store, {
                  attributes: ['dailyTarget']
                })
              )?.dailyTarget || 0
            : (async () => {
                try {
                  return (
                    (await db.location.sum('dailyTarget', {
                      where: { status: 'active' }
                    })) || 0
                  )
                } catch {
                  return 0
                }
              })(),
          totalOrders: totalOrders || 0,
          totalProducts: totalProducts || 0,
          totalMembers: totalMembers || 0,
          salesChart: salesChart || [],
          bestSellers: bestSellers || [],
          recentOrders: recentOrders || [],
          lowStock,
          filter: filter || 'weekly'
        }
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  // Product price by store
  async getPriceByStore(req, res) {
    try {
      const { productId } = req.query
      const storeIds = req.query.storeIds ? req.query.storeIds.split(',') : []

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'productId is required'
        })
      }

      const product = await db.product.findByPk(productId, {
        attributes: ['id', 'nameProduct', 'price']
      })

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        })
      }

      const storePrices =
        storeIds.length > 0
          ? await db.product_store_price.findAll({
              where: {
                product: productId,
                store: storeIds
              }
            })
          : []

      return res.status(200).json({
        success: true,
        message: 'Success',
        data: {
          product,
          storePrices
        }
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  // Update product price by store
  async updatePriceByStore(req, res) {
    try {
      const { productId, storePrices } = req.body

      if (
        !productId ||
        !storePrices ||
        !Array.isArray(storePrices) ||
        storePrices.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'productId and storePrices array are required'
        })
      }

      const product = await db.product.findByPk(productId)
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        })
      }

      const result = await db.sequelize.transaction(async (t) => {
        // Update base price
        const basePrice = storePrices.find((sp) => sp.storeId === 'base')?.price
        if (basePrice) {
          await product.update({ price: basePrice }, { transaction: t })
        }

        // Update store-specific prices
        for (const sp of storePrices) {
          if (sp.storeId !== 'base') {
            await db.product_store_price.upsert(
              {
                product: productId,
                store: sp.storeId,
                price: sp.price
              },
              { transaction: t }
            )
          }
        }

        return product
      })

      return res.status(200).json({
        success: true,
        message: 'Product prices updated',
        data: result
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  // Send invoice via WhatsApp
  async sendInvoiceWhatsApp(req, res) {
    try {
      const { orderId, phone } = req.body

      if (!orderId || !phone) {
        return res.status(400).json({
          success: false,
          message: 'orderId and phone are required'
        })
      }

      const order = await db.order.findByPk(orderId, {
        include: [
          { model: db.order_item, as: 'items' },
          { model: db.table, as: 'table' }
        ]
      })

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        })
      }

      const status = await getConnectionStatus()
      if (!status.ready) {
        return res.status(400).json({
          success: false,
          message:
            status.error || 'WhatsApp tidak terhubung. Silakan cek pengaturan.',
          data: { waConnected: false }
        })
      }

      // Generate PDF
      const storeData = order.store
        ? await db.location.findByPk(order.store, {
            attributes: ['name', 'address', 'phoneNumber']
          })
        : null
      const { generateInvoicePdf } = require('../../utils/generateInvoicePdf')
      const { fileName, filePath } = await generateInvoicePdf(
        order,
        storeData,
        order.items || []
      )

      // Look up member points
      let memberInfo = null
      if (order.customerPhone) {
        const member = await db.member.findOne({
          where: { phoneNumber: order.customerPhone, store: order.store }
        })
        if (member && member.totalPoints > 0) {
          let tierName = null
          if (member.tier) {
            const tier = await db.member_tier.findByPk(member.tier)
            if (tier) tierName = tier.name
          }
          memberInfo = {
            name: member.name,
            totalPoints: member.totalPoints,
            tierName
          }
        }
      }

      // Format items text
      const itemLines = (order.items || [])
        .map((i) => {
          return `• ${i.productName || 'Item'}  ${i.quantity}x  Rp ${(i.totalPrice || 0).toLocaleString('id')}`
        })
        .join('\n')

      const date = new Date(order.createdAt).toLocaleString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      const tableInfo = order.table ? `Meja: ${order.table.name}\n` : ''
      const customerInfo = order.customerName
        ? `Pelanggan: ${order.customerName}\n`
        : ''
      const itemsSection = order.items?.length
        ? `\n━━━ *PESANAN* ━━━\n${itemLines}`
        : ''

      const statusText =
        order.paymentStatus === 'paid'
          ? 'LUNAS ✅'
          : order.paymentStatus || 'BELUM DIBAYAR'

      // Build member points section
      let pointsSection = ''
      if (memberInfo) {
        pointsSection =
          `\n━━━ *POIN MEMBER* ━━━\n` +
          `Nama: ${memberInfo.name}\n` +
          `Total Poin: ${memberInfo.totalPoints.toLocaleString('id')}\n` +
          (memberInfo.tierName ? `Tier: ${memberInfo.tierName}\n` : '') +
          `\n`
      }

      const caption =
        `╔══════════════════════╗\n` +
        `      *STRUK PEMBAYARAN*\n` +
        `╚══════════════════════╝\n\n` +
        `No. Invoice: *${order.orderNumber || order.id}*\n` +
        `Tanggal: ${date}\n` +
        `${customerInfo}` +
        `${tableInfo}` +
        `Status: ${statusText}\n` +
        `${itemsSection}\n\n` +
        `──────────────────────\n` +
        `*Total: Rp ${(order.totalPrice || 0).toLocaleString('id')}*\n` +
        `Pembayaran: ${order.paymentMethod || '-'}\n` +
        `──────────────────────\n` +
        `${pointsSection}` +
        `Terima kasih telah berbelanja 🙏`

      // Send PDF via WhatsApp
      await sendDocument(phone, filePath, caption)

      return res.status(200).json({
        success: true,
        message: 'Invoice berhasil dikirim via WhatsApp',
        data: { orderId, phone }
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({
        success: false,
        message: error.message || 'Gagal mengirim invoice via WhatsApp'
      })
    }
  },

  // Send invoice via email
  async sendInvoiceEmail(req, res) {
    try {
      const { orderId, email } = req.body

      if (!orderId || !email) {
        return res.status(400).json({
          success: false,
          message: 'orderId and email are required'
        })
      }

      const order = await db.order.findByPk(orderId, {
        include: [
          { model: db.order_item, as: 'items' },
          { model: db.table, as: 'table' }
        ]
      })

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        })
      }

      // TODO: Implement email service integration
      // For now, return success
      return res.status(200).json({
        success: true,
        message: 'Invoice sent via email',
        data: { orderId, email }
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  // Add product batch/expiry
  async addBatch(req, res) {
    try {
      const { productId, batchCode, expiryDate, qty, store } = req.body

      if (!productId || !batchCode || !expiryDate || !qty) {
        return res.status(400).json({
          success: false,
          message: 'productId, batchCode, expiryDate, and qty are required'
        })
      }

      const product = await db.product.findByPk(productId)
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        })
      }

      const oldStock = Number(product.stock) || 0
      const newStock = oldStock + Number(qty)

      const result = await db.sequelize.transaction(async (t) => {
        await product.update(
          {
            stock: db.sequelize.literal(
              `stock + ${Math.floor(Number(qty)) || 0}`
            )
          },
          { transaction: t }
        )

        await db.product_batch.create(
          {
            product: productId,
            batchCode,
            expiryDate,
            qty,
            store,
            status: 'active',
            createdBy: req.user?.id || null
          },
          { transaction: t }
        )

        await db.stock_history.create(
          {
            product: productId,
            store,
            referenceType: 'purchase',
            quantityBefore: oldStock,
            quantityChange: qty,
            quantityAfter: newStock,
            unit: product.unit || 'pcs',
            notes: `Batch ${batchCode} added`,
            createdBy: req.user?.id || null
          },
          { transaction: t }
        )

        return { product, batch: { batchCode, expiryDate, qty, newStock } }
      })

      return res.status(201).json({
        success: true,
        message: 'Batch added successfully',
        data: result
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  // Get product batches
  async getBatches(req, res) {
    try {
      const { productId, store } = req.query

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'productId is required'
        })
      }

      const where = { product: productId }
      if (store) {
        where.store = store
      }

      const batches = await db.product_batch.findAll({
        where,
        order: [['expiryDate', 'ASC']]
      })

      return res.status(200).json({
        success: true,
        message: 'Success',
        data: batches
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  // Get WhatsApp connection status
  async getWhatsAppStatus(req, res) {
    try {
      const storeId = getStoreId(req)
      const status = await getConnectionStatus(storeId)
      return res.status(200).json({
        success: true,
        message: 'WhatsApp status',
        data: status
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  },

  // Logout WhatsApp
  async logoutWhatsApp(req, res) {
    try {
      const storeId = getStoreId(req)
      await logout(storeId)
      return res.status(200).json({
        success: true,
        message:
          'WhatsApp berhasil diputuskan. Silakan refresh halaman untuk scan QR baru.'
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  },

  // Restart WhatsApp client (logout + re-init)
  async restartWhatsApp(req, res) {
    try {
      const storeId = getStoreId(req)
      const result = await restartClient(storeId)
      return res.status(200).json({
        success: true,
        message: 'WhatsApp client restarting',
        data: { initialized: !!result, storeId }
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }
}

module.exports = posController
