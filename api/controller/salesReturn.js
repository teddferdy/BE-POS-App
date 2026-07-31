const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')

const salesReturnController = {
  async getAll(req, res) {
    try {
      const { store: cookieStore } = req.cookies
      const userRole = req.user?.roleType
      const {
        page = 1,
        limit = 10,
        status,
        startDate,
        endDate,
        store: queryStore,
        search
      } = req.query

      const where = {}
      const effectiveStore =
        userRole === 'super_admin' ? queryStore || cookieStore : cookieStore
      if (effectiveStore) where.store = effectiveStore
      if (status) where.status = status
      if (search) {
        where[Op.or] = [
          { returnNumber: { [Op.iLike]: `%${search}%` } },
          { reason: { [Op.iLike]: `%${search}%` } }
        ]
      }
      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt[Op.gte] = new Date(startDate)
        if (endDate) where.createdAt[Op.lte] = new Date(endDate + 'T23:59:59')
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const { count, rows } = await db.sales_return.findAndCountAll({
        where,
        include: [
          {
            model: db.sales_return_item,
            as: 'items',
            include: [
              {
                model: db.product,
                as: 'productData',
                attributes: ['id', 'nameProduct']
              }
            ]
          },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] },
          {
            model: db.user,
            as: 'returnedByData',
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

      const ret = await db.sales_return.findOne({
        where,
        include: [
          {
            model: db.sales_return_item,
            as: 'items',
            include: [
              {
                model: db.product,
                as: 'productData',
                attributes: ['id', 'nameProduct']
              }
            ]
          },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] },
          {
            model: db.user,
            as: 'returnedByData',
            attributes: ['id', 'fullName']
          }
        ]
      })

      if (!ret) {
        return res
          .status(404)
          .json({ success: false, message: 'Sales return not found' })
      }

      return res
        .status(200)
        .json({ success: true, message: 'Success', data: ret })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async approve(req, res) {
    const transaction = await db.sequelize.transaction()
    try {
      const { id } = req.params
      const { store } = req.cookies
      const userRole = req.user?.roleType

      const where = { id }
      if (store && userRole !== 'super_admin') where.store = store

      const ret = await db.sales_return.findOne({
        where,
        include: [{ model: db.sales_return_item, as: 'items' }],
        transaction
      })

      if (!ret) {
        await transaction.rollback()
        return res.status(404).json({ success: false, message: 'Sales return not found' })
      }

      if (ret.status !== 'pending') {
        await transaction.rollback()
        return res.status(400).json({
          success: false,
          message: 'Only pending returns can be approved'
        })
      }

      const order = await db.order.findByPk(ret.order, { transaction })
      if (!order) {
        await transaction.rollback()
        return res.status(404).json({ success: false, message: 'Original order not found' })
      }

      for (const item of ret.items) {
        const product = await db.product.findByPk(item.product, { transaction })
        if (!product) {
          await transaction.rollback()
          return res.status(404).json({ success: false, message: `Product ${item.product} not found` })
        }
      }

      // 1. Restore Stock
      for (const item of ret.items) {
        const product = await db.product.findByPk(item.product, { transaction })
        if (!product) continue

        const bom = await db.bom_header.findOne({
          where: { productId: item.product, status: 'active' },
          include: [{ model: db.bom_line, as: 'lines' }],
          transaction
        })

        if (!bom) {
          const oldStock = Number(product.stock) || 0
          const qty = Math.floor(Number(item.qty)) || 0
          await product.update(
            { stock: db.sequelize.literal(`stock + ${qty}`) },
            { transaction }
          )

          // Update per-store stock
          await db.sequelize.query(
            `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
             VALUES ($1, $2, 0, NOW(), NOW())
             ON CONFLICT (product, store) DO NOTHING`,
            { bind: [item.product, ret.store], transaction }
          )
          await db.product_store_stock.update(
            { stock: db.sequelize.literal(`stock + ${qty}`) },
            { where: { product: item.product, store: ret.store }, transaction }
          )

          await db.stock_history.create(
            {
              product: item.product,
              store: ret.store,
              referenceType: 'sale_return',
              referenceId: ret.id,
              quantityBefore: oldStock,
              quantityChange: item.qty,
              quantityAfter: oldStock + item.qty,
              unit: item.unit || 'pcs',
              notes: `Sales return approved: ${ret.reason}`,
              createdBy: req.user?.id || null
            },
            { transaction }
          )
        } else {
          for (const line of bom.lines) {
            const ing = await db.ingredient.findByPk(line.ingredientId, { transaction })
            if (!ing) continue
            const restoreQty = line.qty * Number(item.qty)
            const oldIngStock = Number(ing.stock)
            await ing.update(
              { stock: db.sequelize.literal(`stock + ${restoreQty}`) },
              { transaction }
            )
            await db.stock_history.create(
              {
                product: product.id,
                ingredient: ing.id,
                ingredientName: ing.name,
                store: ret.store,
                referenceType: 'sale_return',
                referenceId: ret.id,
                quantityBefore: oldIngStock,
                quantityChange: restoreQty,
                quantityAfter: oldIngStock + restoreQty,
                unit: line.unit || ing.unit || 'pcs',
                notes: `Sales return approved (BOM): ${ret.reason}`,
                createdBy: req.user?.id || null
              },
              { transaction }
            )
          }
          // Also restore the finished product stock for BOM items
          const oldProductStock = Number(product.stock) || 0
          const productQty = Math.floor(Number(item.qty)) || 0
          await product.update(
            { stock: db.sequelize.literal(`stock + ${productQty}`) },
            { transaction }
          )
          await db.stock_history.create(
            {
              product: product.id,
              store: ret.store,
              referenceType: 'sale_return',
              referenceId: ret.id,
              quantityBefore: oldProductStock,
              quantityChange: productQty,
              quantityAfter: oldProductStock + productQty,
              unit: product.unit || 'pcs',
              notes: `Sales return approved (BOM product): ${ret.reason}`,
              createdBy: req.user?.id || null
            },
            { transaction }
          )
        }
      }

      // 2. Refund Transaction
      if (ret.refundAmount > 0) {
        await db.transaction.create(
          {
            order: ret.order,
            typePayment: 'Refund (Sales Return)',
            amount: -Math.abs(ret.refundAmount),
            notes: `Refund for return ${ret.returnNumber}`,
            createdBy: req.user?.id || null
          },
          { transaction }
        )
      }

      // 3. Update Return Status
      await ret.update({ status: 'approved' }, { transaction })

      // 4. Recompute Order Payment Status
      const updatedOrder = await db.order.findByPk(ret.order, {
        include: [{ model: db.transaction, as: 'transactions' }],
        transaction
      })
      if (updatedOrder) {
        const totalPaid = updatedOrder.transactions.reduce((sum, t) => sum + Number(t.amount), 0)
        let newPaymentStatus = 'unpaid'
        if (totalPaid >= updatedOrder.totalPrice) {
          newPaymentStatus = 'paid'
        } else if (totalPaid > 0) {
          newPaymentStatus = 'partial'
        }
        await updatedOrder.update({ paymentStatus: newPaymentStatus }, { transaction })
      }

      await transaction.commit()
      await createAudit(req, 'update', 'sales_return', id, 'Approved sales return: ' + ret.returnNumber)

      return res.status(200).json({ success: true, message: 'Sales return approved', data: ret })
    } catch (error) {
      await transaction.rollback()
      console.error(error)
      return res.status(500).json({ success: false, message: error.message || 'Internal server error' })
    }
  },

  async reject(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies
      const userRole = req.user?.roleType

      const where = { id }
      if (store && userRole !== 'super_admin') where.store = store

      const ret = await db.sales_return.findOne({ where })
      if (!ret) {
        return res.status(404).json({ success: false, message: 'Sales return not found' })
      }

      if (ret.status === 'rejected') {
        return res.status(200).json({ success: true, message: 'Sales return already rejected', data: ret })
      }

      if (ret.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Only pending returns can be rejected'
        })
      }

      await ret.update({ status: 'rejected' })
      await createAudit(req, 'update', 'sales_return', id, 'Rejected sales return: ' + ret.returnNumber)

      return res.status(200).json({ success: true, message: 'Sales return rejected', data: ret })
    } catch (error) {
      console.error(error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
}

module.exports = salesReturnController
