const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')

async function attachPriceInfo(json, poId) {
  if (!json.items || json.items.length === 0) return json
  const poItems = await db.purchase_order_item.findAll({
    where: { purchaseOrder: poId },
    attributes: ['ingredient', 'product', 'price']
  })
  const priceMap = {}
  poItems.forEach((pi) => {
    if (pi.ingredient)
      priceMap[`ing-${pi.ingredient}`] = parseFloat(pi.price) || 0
    if (pi.product) priceMap[`prod-${pi.product}`] = parseFloat(pi.price) || 0
  })
  json.items = json.items.map((item) => {
    const key = item.ingredient?.id
      ? `ing-${item.ingredient.id}`
      : item.product?.id
        ? `prod-${item.product.id}`
        : null
    item.price = key ? priceMap[key] || 0 : 0
    item.subtotal = item.price * (parseFloat(item.qty) || 0)
    return item
  })
  json.totalAmount = json.items.reduce((s, i) => s + i.subtotal, 0)
  return json
}

const purchaseReturnController = {
  async getAll(req, res) {
    try {
      const { store: cookieStore } = req.cookies
      const userRole = req.user?.roleType
      const { page = 1, limit = 10, status, startDate, endDate, store: queryStore, search, supplier } = req.query

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
      if (supplier) where.supplier = supplier
      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt[Op.gte] = new Date(startDate)
        if (endDate) where.createdAt[Op.lte] = new Date(endDate + 'T23:59:59')
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const statsWhere = effectiveStore ? { store: effectiveStore } : {}
      const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
        db.purchase_return.count({
          where: { ...statsWhere, status: 'pending' }
        }),
        db.purchase_return.count({
          where: { ...statsWhere, status: 'approved' }
        }),
        db.purchase_return.count({
          where: { ...statsWhere, status: 'rejected' }
        })
      ])
      const stats = {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount
      }

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
              },
              {
                model: db.ingredient,
                as: 'ingredientData',
                attributes: ['id', 'name']
              }
            ]
          },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] },
          {
            model: db.user,
            as: 'createdByUser',
            attributes: ['id', 'fullName']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      const transformed = rows.map((r) => {
        const json = r.toJSON()
        if (json.createdByUser) {
          json.returnedBy = {
            id: json.createdByUser.id,
            name: json.createdByUser.fullName
          }
        } else if (json.returnedBy) {
          json.returnedBy = { name: json.returnedBy }
        }
        delete json.createdByUser
        if (json.items) {
          json.items = json.items.map((item) => {
            if (item.productData) {
              item.product = {
                id: item.productData.id,
                name: item.productData.nameProduct
              }
            }
            delete item.productData
            if (item.ingredientData) {
              item.ingredient = {
                id: item.ingredientData.id,
                name: item.ingredientData.name
              }
            }
            delete item.ingredientData
            item.purchaseReturn = {
              id: item.purchaseReturn,
              name: json.returnNumber
            }
            return item
          })
        }
        return json
      })

      return res.status(200).json({
        success: true,
        message: 'Success',
        data: transformed,
        stats,
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
              },
              {
                model: db.ingredient,
                as: 'ingredientData',
                attributes: ['id', 'name']
              }
            ]
          },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] },
          {
            model: db.user,
            as: 'createdByUser',
            attributes: ['id', 'fullName']
          }
        ]
      })

      if (!ret) {
        return res
          .status(404)
          .json({ success: false, message: 'Purchase return not found' })
      }

      const result = ret.toJSON()
      if (result.createdByUser) {
        result.returnedBy = {
          id: result.createdByUser.id,
          name: result.createdByUser.fullName
        }
      } else if (result.returnedBy) {
        result.returnedBy = { name: result.returnedBy }
      }
      delete result.createdByUser
      if (result.items) {
        result.items = result.items.map((item) => {
          if (item.productData) {
            item.product = {
              id: item.productData.id,
              name: item.productData.nameProduct
            }
          }
          delete item.productData
          if (item.ingredientData) {
            item.ingredient = {
              id: item.ingredientData.id,
              name: item.ingredientData.name
            }
          }
          delete item.ingredientData
          item.purchaseReturn = {
            id: item.purchaseReturn,
            name: result.returnNumber
          }
          return item
        })
      }

      const enriched = await attachPriceInfo(result, result.purchaseOrder)

      // ponytail: attach PO orderNumber for display
      if (enriched.purchaseOrder) {
        const po = await db.purchase_order.findByPk(enriched.purchaseOrder, {
          attributes: ['id', 'orderNumber']
        })
        enriched.purchaseOrder = po
          ? { id: po.id, orderNumber: po.orderNumber }
          : { id: enriched.purchaseOrder, orderNumber: null }
      }

      return res
        .status(200)
        .json({ success: true, message: 'Success', data: enriched })
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
  },

  async getByPO(req, res) {
    try {
      const { poId } = req.params

      const where = { purchaseOrder: poId }

      const returns = await db.purchase_return.findAll({
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
              },
              {
                model: db.ingredient,
                as: 'ingredientData',
                attributes: ['id', 'name']
              }
            ]
          },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] },
          {
            model: db.user,
            as: 'createdByUser',
            attributes: ['id', 'fullName']
          }
        ],
        order: [['createdAt', 'DESC']]
      })

      const transformed = returns.map((r) => {
        const json = r.toJSON()
        if (json.createdByUser) {
          json.returnedBy = {
            id: json.createdByUser.id,
            name: json.createdByUser.fullName
          }
        } else if (json.returnedBy) {
          json.returnedBy = { name: json.returnedBy }
        }
        delete json.createdByUser
        if (json.items) {
          json.items = json.items.map((item) => {
            if (item.productData) {
              item.product = {
                id: item.productData.id,
                name: item.productData.nameProduct
              }
            }
            delete item.productData
            if (item.ingredientData) {
              item.ingredient = {
                id: item.ingredientData.id,
                name: item.ingredientData.name
              }
            }
            delete item.ingredientData
            item.purchaseReturn = {
              id: item.purchaseReturn,
              name: json.returnNumber
            }
            return item
          })
        }
        return json
      })

      const enriched = await Promise.all(
        transformed.map((r) => attachPriceInfo(r, parseInt(poId)))
      )

      return res.status(200).json({ success: true, data: enriched })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async create(req, res) {
    try {
      const { purchaseOrder: poId, items, reason, returnedBy } = req.body
      const createdBy = req.user?.id || null

      if (!poId) {
        return res.status(400).json({
          success: false,
          message: 'Purchase order ID is required'
        })
      }

      const po = await db.purchase_order.findByPk(poId)
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

      if (!items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one item is required'
        })
      }

      const store = req.cookies.store || po.store

      const date = new Date()
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
      const returnNumber = `PR-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${rand}`

      const t = await db.sequelize.transaction()
      try {
        const ret = await db.purchase_return.create({
          purchaseOrder: po.id,
          store,
          returnNumber,
          status: 'pending',
          reason: reason || null,
          returnedBy: returnedBy || null,
          createdBy
        }, { transaction: t })

        const retItems = items.map((item) => ({
          purchaseReturn: ret.id,
          product: item.productId || null,
          ingredient: item.ingredient || null,
          qty: item.qty,
          unit: item.unit || 'pcs',
          notes: item.notes || null
        }))
        await db.purchase_return_item.bulkCreate(retItems, { transaction: t })

        for (const item of items) {
          if (item.productId) {
            const product = await db.product.findByPk(item.productId, { transaction: t })
            if (product) {
              const oldStock = Number(product.stock) || 0
              const newStock = Math.max(0, oldStock - item.qty)
              await product.update({ stock: newStock }, { transaction: t })
              await db.stock_history.create({
                product: item.productId,
                store,
                referenceType: 'purchase_return',
                referenceId: ret.id,
                quantityBefore: oldStock,
                quantityChange: -(oldStock - newStock),
                quantityAfter: newStock,
                unit: item.unit || 'pcs',
                createdBy
              }, { transaction: t })
            }
          }
          if (item.ingredient) {
            const ingredient = await db.ingredient.findByPk(item.ingredient, { transaction: t })
            if (ingredient) {
              const oldStock = Number(ingredient.stock) || 0
              const newStock = Math.max(0, oldStock - item.qty)
              await ingredient.update({ stock: newStock }, { transaction: t })
              await db.stock_history.create({
                ingredientName: ingredient.name,
                store,
                referenceType: 'purchase_return',
                referenceId: ret.id,
                quantityBefore: oldStock,
                quantityChange: -(oldStock - newStock),
                quantityAfter: newStock,
                unit: item.unit || ingredient.unit || 'pcs',
                createdBy
              }, { transaction: t })
            }
          }
        }

        await t.commit()

        await createAudit(req, 'create', 'purchase_return', ret.id, 'Created purchase return: ' + ret.id)

        return res.status(201).json({
          success: true,
          message: 'Purchase return created',
          data: ret
        })
      } catch (err) {
        await t.rollback()
        throw err
      }
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }
}

module.exports = purchaseReturnController
