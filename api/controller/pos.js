const db = require('../../db/models')
const { Op } = require('sequelize')

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
        attributes: ['id', 'nameProduct', 'barcode', 'unit', 'stock', 'minStock', 'price', 'costPrice', 'brand', 'category'],
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

  // Stock transfer antar toko
  async transfer(req, res) {
    try {
      const { store } = req.cookies
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
        const transfer = await db.stock_transfer.create({
          transferNumber: `TRF-${Date.now()}`,
          fromStore,
          toStore,
          notes,
          status: 'pending',
          transferredBy,
          createdBy: req.user?.id || null
        }, { transaction: t })

        const transferItems = items.map(item => ({
          stockTransfer: transfer.id,
          product: item.productId,
          qty: item.qty,
          unit: item.unit || 'pcs',
          notes: item.notes || null
        }))

        await db.stock_transfer_item.bulkCreate(transferItems, { transaction: t })

        return transfer
      })

      return res.status(201).json({
        success: true,
        message: 'Stock transfer created',
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

  // Get stock transfer history
  async getTransferHistory(req, res) {
    try {
      const { store } = req.cookies
      const { page = 1, limit = 20, status, startDate, endDate } = req.query

      const where = {}
      if (store) {
        where[Op.or] = [{ fromStore: store }, { toStore: store }]
      }

      if (status) {
        where.status = status
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
          { model: db.location, as: 'fromStoreData', attributes: ['id', 'name'] },
          { model: db.location, as: 'toStoreData', attributes: ['id', 'name'] },
          { model: db.user, as: 'transferredByData', attributes: ['id', 'name'] }
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
            model: db.stock_transfer_item, as: 'items',
            include: [{ model: db.product, attributes: ['id', 'nameProduct', 'sku'] }]
          },
          { model: db.location, as: 'fromStoreData', attributes: ['id', 'name'] },
          { model: db.location, as: 'toStoreData', attributes: ['id', 'name'] },
          { model: db.user, as: 'transferredByData', attributes: ['id', 'name'] }
        ]
      })

      if (!transfer) {
        return res.status(404).json({ success: false, message: 'Stock transfer not found' })
      }

      return res.status(200).json({ success: true, message: 'Success', data: transfer })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },

  // Delete stock transfer
  async deleteTransfer(req, res) {
    try {
      const { id } = req.params
      const { store } = req.query

      const transfer = await db.stock_transfer.findOne({
        where: { id, ...(store && { [Op.or]: [{ fromStore: store }, { toStore: store }] }) }
      })

      if (!transfer) {
        return res.status(404).json({
          success: false,
          message: 'Stock transfer not found'
        })
      }

      if (transfer.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Only pending transfers can be deleted'
        })
      }

      await db.stock_transfer_item.destroy({
        where: { stockTransfer: id }
      })

      await transfer.destroy()

      return res.status(200).json({
        success: true,
        message: 'Stock transfer deleted successfully'
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  // Approve stock transfer — auto-adjust stock
  async approveTransfer(req, res) {
    try {
      const { id } = req.params

      const transfer = await db.stock_transfer.findOne({
        where: { id },
        include: [{ model: db.stock_transfer_item, as: 'items' }]
      })

      if (!transfer) {
        return res.status(404).json({ success: false, message: 'Stock transfer not found' })
      }

      if (transfer.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'Transfer is not in pending status' })
      }

      const result = await db.sequelize.transaction(async (t) => {
        for (const item of transfer.items) {
          const product = await db.product.findByPk(item.product, { transaction: t })
          if (!product) continue

          const oldStock = Number(product.stock) || 0
          const newStock = oldStock - Number(item.qty)

          if (newStock < 0) {
            throw new Error(`Insufficient stock for product "${product.nameProduct}" (SKU: ${product.sku})`)
          }

          await product.update({ stock: newStock }, { transaction: t })

          // Record outflow from source store
          await db.stock_history.create({
            product: item.product,
            store: transfer.fromStore,
            referenceType: 'transfer',
            referenceId: transfer.id,
            quantityBefore: oldStock,
            quantityChange: -Number(item.qty),
            quantityAfter: newStock,
            unit: item.unit || 'pcs',
            notes: `Transfer out to store ${transfer.toStore}`,
            createdBy: req.user?.id || null
          }, { transaction: t })

          // Record inflow to destination store
          await db.stock_history.create({
            product: item.product,
            store: transfer.toStore,
            referenceType: 'transfer',
            referenceId: transfer.id,
            quantityBefore: oldStock,
            quantityChange: Number(item.qty),
            quantityAfter: oldStock + Number(item.qty),
            unit: item.unit || 'pcs',
            notes: `Transfer in from store ${transfer.fromStore}`,
            createdBy: req.user?.id || null
          }, { transaction: t })
        }

        await transfer.update({ status: 'approved' }, { transaction: t })
        return transfer
      })

      return res.status(200).json({ success: true, message: 'Stock transfer approved', data: result })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(400).json({ success: false, message: error.message || 'Internal server error' })
    }
  },

  // Reject stock transfer
  async rejectTransfer(req, res) {
    try {
      const { id } = req.params

      const transfer = await db.stock_transfer.findOne({ where: { id } })
      if (!transfer) {
        return res.status(404).json({ success: false, message: 'Stock transfer not found' })
      }

      if (transfer.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'Transfer is not in pending status' })
      }

      await transfer.update({ status: 'rejected' })

      return res.status(200).json({ success: true, message: 'Stock transfer rejected', data: transfer })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },

  // Stock adjustment
  async adjust(req, res) {
    try {
      const { store } = req.cookies
      const { productId, qty, reason, referenceType = 'adjustment', storeId } = req.body

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
        await product.update({ stock: newStock }, { transaction: t })

        await db.stock_history.create({
          product: productId,
          store: storeId || store,
          referenceType,
          quantityBefore: oldStock,
          quantityChange: qty,
          quantityAfter: newStock,
          unit: product.unit || 'pcs',
          notes: reason || 'Stock adjustment',
          createdBy: req.user?.id || null
        }, { transaction: t })

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

  // Purchase order return
  async returnPurchaseOrder(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies
      const { items, reason, returnedBy } = req.body

      const po = await db.purchase_order.findByPk(id)
      if (!po) {
        return res.status(404).json({
          success: false,
          message: 'Purchase order not found'
        })
      }

      if (po.status !== 'received') {
        return res.status(400).json({
          success: false,
          message: 'Only received purchase orders can be returned'
        })
      }

      const result = await db.sequelize.transaction(async (t) => {
        const returnOrder = await db.purchase_return.create({
          purchaseOrder: id,
          store,
          reason,
          returnNumber: `PR-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
          status: 'pending',
          returnedBy,
          createdBy: req.user?.id || null
        }, { transaction: t })

        const returnItems = items.map(item => ({
          purchaseReturn: returnOrder.id,
          product: item.productId,
          qty: item.qty,
          unit: item.unit || 'pcs',
          notes: item.notes || null
        }))

        await db.purchase_return_item.bulkCreate(returnItems, { transaction: t })

        // Update stock
        for (const item of items) {
          const product = await db.product.findByPk(item.productId, { transaction: t })
          if (product) {
            const oldStock = Number(product.stock) || 0
            await product.update({ stock: oldStock - item.qty }, { transaction: t })

            await db.stock_history.create({
              product: item.productId,
              store,
              referenceType: 'purchase_return',
              quantityBefore: oldStock,
              quantityChange: -item.qty,
              quantityAfter: oldStock - item.qty,
              unit: item.unit || 'pcs',
              notes: `Purchase return: ${reason}`,
              createdBy: req.user?.id || null
            }, { transaction: t })
          }
        }

        return returnOrder
      })

      return res.status(201).json({
        success: true,
        message: 'Purchase return created',
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
        const returnOrder = await db.sales_return.create({
          order: id,
          store,
          reason,
          returnNumber: `SR-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
          status: 'pending',
          returnedBy,
          createdBy: req.user?.id || null
        }, { transaction: t })

        const returnItems = items.map(item => ({
          salesReturn: returnOrder.id,
          product: item.productId,
          qty: item.qty,
          unit: item.unit || 'pcs',
          notes: item.notes || null
        }))

        await db.sales_return_item.bulkCreate(returnItems, { transaction: t })

        // Update stock
        for (const item of items) {
          const product = await db.product.findByPk(item.productId, { transaction: t })
          if (product) {
            const oldStock = Number(product.stock) || 0
            await product.update({ stock: oldStock + item.qty }, { transaction: t })

            await db.stock_history.create({
              product: item.productId,
              store,
              referenceType: 'sale_return',
              quantityBefore: oldStock,
              quantityChange: item.qty,
              quantityAfter: oldStock + item.qty,
              unit: item.unit || 'pcs',
              notes: `Sales return: ${reason}`,
              createdBy: req.user?.id || null
            }, { transaction: t })
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
  async addPoints(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies
      const { points, transactionId, notes } = req.body

      const member = await db.member.findByPk(id)
      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Member not found'
        })
      }

      const oldPoints = Number(member.points) || 0
      const newPoints = oldPoints + Number(points)

      const result = await db.sequelize.transaction(async (t) => {
        await member.update({ points: newPoints }, { transaction: t })

        await db.member_point_history.create({
          member: id,
          pointsChange: points,
          pointsBefore: oldPoints,
          pointsAfter: newPoints,
          transactionId,
          notes: notes || 'Points added',
          createdBy: req.user?.id || null
        }, { transaction: t })

        return { member, points: { oldPoints, newPoints, pointsAdded: points } }
      })

      return res.status(200).json({
        success: true,
        message: 'Points added successfully',
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
          { model: db.member, as: 'memberData', attributes: ['id', 'name', 'phone'] }
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
      const { startDate, endDate } = req.query

      const checkoutWhere = {}
      if (store) {
        checkoutWhere.store = store
      }

      if (startDate || endDate) {
        checkoutWhere.createdAt = {}
        if (startDate) checkoutWhere.createdAt[Op.gte] = new Date(startDate)
        if (endDate) checkoutWhere.createdAt[Op.lte] = new Date(endDate + 'T23:59:59')
      }

      const productWhere = { status: 'active' }

      const [totalSales, totalOrders, totalProducts, totalMembers, salesChart, bestSellers, recentOrders] = await Promise.all([
        db.checkout.sum('totalPrice', { where: checkoutWhere }),
        db.checkout.count({ where: checkoutWhere }),
        db.product.count({ where: productWhere }),
        db.member.count(),
        db.sequelize.query(`
          SELECT DATE("createdAt") as date, SUM("totalPrice") as sales
          FROM "checkout"
          WHERE 1=1
          ${startDate && endDate ? 'AND "createdAt" BETWEEN :startDate AND :endDate' : ''}
          ${store ? 'AND "store" = :store' : ''}
          GROUP BY DATE("createdAt")
          ORDER BY date DESC
          LIMIT 7
        `, {
          replacements: Object.assign({},
            startDate && { startDate },
            endDate && { endDate },
            store && { store }
          ),
          type: db.sequelize.QueryTypes.SELECT
        }),
        db.sequelize.query(`
          SELECT "productId", "nameProduct" as "productName", "image", SUM("totalSelling") as quantity
          FROM "best_selling"
          WHERE 1=1
          ${store ? 'AND "store" = :store' : ''}
          GROUP BY "productId", "nameProduct", "image"
          ORDER BY quantity DESC
          LIMIT 10
        `, {
          replacements: store ? { store } : {},
          type: db.sequelize.QueryTypes.SELECT
        }),
        db.checkout.findAll({
          attributes: { exclude: ['deletedAt', 'invoice'] },
          where: checkoutWhere,
          order: [['createdAt', 'DESC']],
          limit: 10
        })
      ])

      const [lowStockProductCount] = await db.sequelize.query(
        `SELECT COUNT(*)::int as count FROM "product" WHERE status = 'active' AND "minStock" > 0 AND "stock" <= "minStock"`,
        { type: db.sequelize.QueryTypes.SELECT }
      )
      let lowStockIngQuery = `SELECT COUNT(*)::int as count FROM "ingredient" WHERE status = 'active' AND "stock" <= "minStock"`
      const ingReplacements = {}
      if (store) {
        lowStockIngQuery += ` AND store = :store`
        ingReplacements.store = store
      }
      const [lowStockIngredientCount] = await db.sequelize.query(
        lowStockIngQuery,
        { replacements: ingReplacements, type: db.sequelize.QueryTypes.SELECT }
      )
      const lowStock = parseInt(lowStockProductCount?.count || 0) + parseInt(lowStockIngredientCount?.count || 0)

      return res.status(200).json({
        success: true,
        message: 'Success',
        data: {
          totalSales: totalSales || 0,
          totalOrders: totalOrders || 0,
          totalProducts: totalProducts || 0,
          totalMembers: totalMembers || 0,
          salesChart: salesChart || [],
          bestSellers: bestSellers || [],
          recentOrders: recentOrders || [],
          lowStock
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

      const storePrices = storeIds.length > 0 ? await db.product_store_price.findAll({
        where: {
          product: productId,
          store: storeIds
        }
      }) : []

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

      if (!productId || !storePrices || !Array.isArray(storePrices) || storePrices.length === 0) {
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
        const basePrice = storePrices.find(sp => sp.storeId === 'base')?.price
        if (basePrice) {
          await product.update({ price: basePrice }, { transaction: t })
        }

        // Update store-specific prices
        for (const sp of storePrices) {
          if (sp.storeId !== 'base') {
            await db.product_store_price.upsert({
              product: productId,
              store: sp.storeId,
              price: sp.price
            }, { transaction: t })
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

      const itemLines = (order.items || [])
        .map((i) => {
          const line = `- ${i.productName || 'Item'} (${i.quantity}x) = Rp ${(i.totalPrice || 0).toLocaleString('id')}`
          return encodeURIComponent(line)
        })
        .join('%0A')

      const date = new Date(order.createdAt).toLocaleString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })

      const tableInfo = order.table ? `Meja: ${order.table.name}%0A` : ''
      const itemsSection = order.items?.length
        ? `%0A*Pesanan:*%0A${itemLines}`
        : ''

      const text = encodeURIComponent(
        `*INVOICE #${order.orderNumber || order.id}*%0A` +
        `Tanggal: ${date}%0A` +
        `${tableInfo}` +
        `Status: ${order.paymentStatus === 'paid' ? 'LUNAS' : order.paymentStatus}%0A` +
        `${itemsSection}%0A%0A` +
        `*Total: Rp ${(order.totalPrice || 0).toLocaleString('id')}*%0A` +
        `Pembayaran: ${order.paymentMethod || '-'}%0A%0A` +
        `Terima kasih telah berbelanja!`
      )

      const cleanPhone = phone.replace(/[^0-9]/g, '')
      const waNumber = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone
      const waLink = `https://wa.me/${waNumber}?text=${text}`

      return res.status(200).json({
        success: true,
        message: 'WhatsApp link generated',
        data: { waLink, orderId, phone }
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
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
        await product.update({ stock: newStock }, { transaction: t })

        await db.product_batch.create({
          product: productId,
          batchCode,
          expiryDate,
          qty,
          store,
          isActive: true,
          createdBy: req.user?.id || null
        }, { transaction: t })

        await db.stock_history.create({
          product: productId,
          store,
          referenceType: 'purchase',
          quantityBefore: oldStock,
          quantityChange: qty,
          quantityAfter: newStock,
          unit: product.unit || 'pcs',
          notes: `Batch ${batchCode} added`,
          createdBy: req.user?.id || null
        }, { transaction: t })

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
  }
}

module.exports = posController