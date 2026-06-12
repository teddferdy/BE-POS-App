const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')

const purchaseReturnController = {
  async getAll(req, res) {
    try {
      const { store } = req.cookies
      const userRole = req.user?.roleType
      const { page = 1, limit = 10, status, startDate, endDate } = req.query

      const where = {}
      if (store && userRole !== 'super_admin') where.store = store
      if (status) where.status = status
      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt[Op.gte] = new Date(startDate)
        if (endDate) where.createdAt[Op.lte] = new Date(endDate + 'T23:59:59')
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const { count, rows } = await db.purchase_return.findAndCountAll({
        where,
        include: [
          {
            model: db.purchase_return_item,
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

      const ret = await db.purchase_return.findOne({
        where,
        include: [
          {
            model: db.purchase_return_item,
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
          .json({ success: false, message: 'Purchase return not found' })
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

      const ret = await db.purchase_return.findOne({ where })
      if (!ret) {
        return res
          .status(404)
          .json({ success: false, message: 'Purchase return not found' })
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
        'purchase_return',
        id,
        'Approved purchase return: ' + id
      )

      return res
        .status(200)
        .json({ success: true, message: 'Purchase return approved', data: ret })
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

      const ret = await db.purchase_return.findOne({
        where,
        include: [{ model: db.purchase_return_item, as: 'items' }]
      })

      if (!ret) {
        return res
          .status(404)
          .json({ success: false, message: 'Purchase return not found' })
      }

      if (ret.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Only pending returns can be rejected'
        })
      }

      const transaction = await db.sequelize.transaction()
      try {
        // Reverse stock: add back what was deducted on creation
        for (const item of ret.items) {
          const product = await db.product.findByPk(item.product, {
            transaction
          })
          if (product) {
            const oldStock = Number(product.stock) || 0
            await product.update(
              { stock: oldStock + item.qty },
              { transaction }
            )

            await db.stock_history.create(
              {
                product: item.product,
                store: ret.store,
                referenceType: 'adjustment',
                quantityBefore: oldStock,
                quantityChange: item.qty,
                quantityAfter: oldStock + item.qty,
                unit: item.unit || 'pcs',
                notes: `Purchase return rejected: ${ret.reason}`,
                createdBy: req.user?.id || null
              },
              { transaction }
            )
          }

          const ingredient = item.ingredient
            ? await db.ingredient.findByPk(item.ingredient, { transaction })
            : null
          if (ingredient) {
            const oldStock = Number(ingredient.stock) || 0
            await ingredient.update(
              { stock: oldStock + item.qty },
              { transaction }
            )

            await db.stock_history.create(
              {
                ingredientName: ingredient.name,
                store: ret.store,
                referenceType: 'adjustment',
                quantityBefore: oldStock,
                quantityChange: item.qty,
                quantityAfter: oldStock + item.qty,
                unit: item.unit || ingredient.unit || 'pcs',
                notes: `Purchase return rejected: ${ret.reason}`,
                createdBy: req.user?.id || null
              },
              { transaction }
            )
          }
        }

        await ret.update({ status: 'rejected' }, { transaction })
        await transaction.commit()

        await createAudit(
          req,
          'update',
          'purchase_return',
          id,
          'Rejected purchase return: ' + id
        )

        return res.status(200).json({
          success: true,
          message: 'Purchase return rejected',
          data: ret
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
  }
}

module.exports = purchaseReturnController
