const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')

const salesReturnController = {
  async getAll(req, res) {
    try {
      const { store: cookieStore } = req.cookies
      const userRole = req.user?.roleType
      const { page = 1, limit = 10, status, startDate, endDate, store: queryStore, search } = req.query

      const where = {}
      const effectiveStore = userRole === 'super_admin' ? (queryStore || cookieStore) : cookieStore
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
    try {
      const { id } = req.params
      const { store } = req.cookies
      const userRole = req.user?.roleType

      const where = { id }
      if (store && userRole !== 'super_admin') where.store = store

      const ret = await db.sales_return.findOne({ where })
      if (!ret) {
        return res
          .status(404)
          .json({ success: false, message: 'Sales return not found' })
      }

      if (ret.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Only pending returns can be approved'
        })
      }

      await ret.update({ status: 'approved' })
      await createAudit(
        req,
        'update',
        'sales_return',
        id,
        'Approved sales return: ' + id
      )

      return res
        .status(200)
        .json({ success: true, message: 'Sales return approved', data: ret })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async reject(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies
      const userRole = req.user?.roleType

      const where = { id }
      if (store && userRole !== 'super_admin') where.store = store

      const ret = await db.sales_return.findOne({
        where,
        include: [{ model: db.sales_return_item, as: 'items' }]
      })

      if (!ret) {
        return res
          .status(404)
          .json({ success: false, message: 'Sales return not found' })
      }

      if (ret.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Only pending returns can be rejected'
        })
      }

      const transaction = await db.sequelize.transaction()
      try {
        // Reverse stock: deduct what was added on creation
        for (const item of ret.items) {
          const product = await db.product.findByPk(item.product, {
            transaction
          })
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
              { stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`) },
              { transaction }
            )

            // ponytail: atomic upsert + deduct per-store stock
            if (ret.store) {
              await db.sequelize.query(
                `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
                 VALUES ($1, $2, 0, NOW(), NOW())
                 ON CONFLICT (product, store) DO NOTHING`,
                { bind: [item.product, ret.store], transaction }
              )
              await db.product_store_stock.update(
                { stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`) },
                { where: { product: item.product, store: ret.store }, transaction }
              )
            }

            await db.stock_history.create(
              {
                product: item.product,
                store: ret.store,
                referenceType: 'sale_return_reversal',
                quantityBefore: oldStock,
                quantityChange: -item.qty,
                quantityAfter: Math.floor(Math.max(0, oldStock - item.qty)),
                unit: item.unit || 'pcs',
                notes: `Sales return rejected: ${ret.reason}`,
                createdBy: req.user?.id || null
              },
              { transaction }
            )
          } else {
            for (const line of bom.lines) {
              const ing = await db.ingredient.findByPk(line.ingredientId, {
                transaction
              })
              if (!ing) continue
              const deductQty = line.qty * Number(item.qty)
              const oldIngStock = Number(ing.stock)
              const qty = Math.floor(Number(deductQty)) || 0
              const newIngStock = Math.max(oldIngStock - qty, 0)
              await ing.update({ stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`) }, { transaction })
              await db.stock_history.create(
                {
                  product: product.id,
                  ingredient: ing.id,
                  ingredientName: ing.name,
                  store: ret.store,
                  referenceType: 'sale_return_reversal',
                  quantityBefore: oldIngStock,
                  quantityChange: -(oldIngStock - newIngStock),
                  quantityAfter: newIngStock,
                  unit: line.unit || ing.unit || 'pcs',
                  notes: `Sales return rejected: ${ret.reason}`,
                  createdBy: req.user?.id || null
                },
                { transaction }
              )
            }
          }
        }

        await ret.update({ status: 'rejected' }, { transaction })
        await transaction.commit()

        await createAudit(
          req,
          'update',
          'sales_return',
          id,
          'Rejected sales return: ' + id
        )

        return res
          .status(200)
          .json({ success: true, message: 'Sales return rejected', data: ret })
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
  }
}

module.exports = salesReturnController
