const db = require('../../db/models')
const { Op } = require('sequelize')
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

async function attachPriceInfo(json, poId) {
  if (!json.items || json.items.length === 0) return json
  const poItems = await db.purchase_order_item.findAll({
    where: { purchaseOrder: poId },
    attributes: ['ingredient', 'product', 'ingredientName', 'price']
  })
  const priceMap = {}
  poItems.forEach((pi) => {
    const price = parseFloat(pi.price) || 0
    if (pi.ingredient) priceMap[`ing-${pi.ingredient}`] = price
    if (pi.product) priceMap[`prod-${pi.product}`] = price
    if (pi.ingredientName) priceMap[`name-${pi.ingredientName}`] = price
  })
  json.items = json.items.map((item) => {
    const key = item.ingredient?.id
      ? `ing-${item.ingredient.id}`
      : item.product?.id
        ? `prod-${item.product.id}`
        : item.ingredientName
          ? `name-${item.ingredientName}`
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
      const {
        page = 1,
        limit = 10,
        status,
        startDate,
        endDate,
        store: queryStore,
        search,
        supplier
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
      if (supplier) {
        const matchingPOItems = await db.purchase_order_item.findAll({
          where: { supplier: Number(supplier) },
          attributes: ['purchaseOrder'],
          raw: true
        })
        const poIds = matchingPOItems.map((item) => item.purchaseOrder)
        where.purchaseOrder = { [Op.in]: poIds }
      }
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
        distinct: true,
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
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
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
      const store = req.storeId || req.cookies.store
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
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
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
      const { resolution = 'credit' } = req.body
      const store = req.storeId || req.cookies.store
      const userRole = req.user?.roleType

      if (!['credit', 'replacement'].includes(resolution)) {
        return res.status(400).json({
          success: false,
          message: 'Resolution must be credit or replacement'
        })
      }

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
          message: 'Only pending returns can be approved'
        })
      }

      const t = await db.sequelize.transaction()
      try {
        await ret.update({ status: 'approved', resolution }, { transaction: t })

        if (ret.purchaseOrder) {
          const po = await db.purchase_order.findByPk(ret.purchaseOrder, {
            transaction: t
          })
          const poItems = await db.purchase_order_item.findAll({
            where: { purchaseOrder: ret.purchaseOrder },
            transaction: t
          })
          const poItemMap = {}
          poItems.forEach((pi) => {
            if (pi.ingredient) poItemMap[`ing-${pi.ingredient}`] = pi
            if (pi.product) poItemMap[`prod-${pi.product}`] = pi
            if (pi.ingredientName) poItemMap[`name-${pi.ingredientName}`] = pi
          })

          let returnTotal = 0
          const resolvedItems = ret.items.map((item) => {
            const key = item.ingredient
              ? `ing-${item.ingredient}`
              : item.product
                ? `prod-${item.product}`
                : item.ingredientName
                  ? `name-${item.ingredientName}`
                  : null
            const poItem = key ? poItemMap[key] : null
            const qty = Number(item.qty) || 0
            const price = poItem ? Number(poItem.price) || 0 : 0
            returnTotal += price * qty
            return { item, poItem, key, qty, price }
          })

          // Returned goods are always credited against the PO bill.
          // For replacement, the new PO re-adds the same cost, so the net
          // effect stays neutral while remaining fully traceable.
          if (returnTotal > 0) {
            await db.purchase_order.update(
              {
                finalAmount: db.sequelize.literal(
                  `GREATEST("purchase_order"."finalAmount" - ${returnTotal}, 0)`
                )
              },
              { where: { id: ret.purchaseOrder }, transaction: t }
            )
          }

          // receivedQuantity is intentionally NOT reduced: the returned qty
          // stays consumed so those units cannot be received again on this PO
          // (prevents double benefit / double receiving).

          if (resolution === 'replacement') {
            const total = resolvedItems.reduce((s, r) => s + r.price * r.qty, 0)
            const supplier =
              resolvedItems.find((r) => r.poItem && r.poItem.supplier)?.poItem
                ?.supplier || null

            const replacementPO = await db.purchase_order.create(
              {
                store: ret.store || null,
                orderNumber: generateOrderNumber('RPL'),
                totalAmount: total,
                discount: 0,
                finalAmount: total,
                status: 'draft',
                orderDate: new Date(),
                notes: `Replacement PO for return ${ret.returnNumber}`,
                createdBy: req.user?.id || null,
                pic: po ? po.pic : null,
                dueDate: po ? po.dueDate : null,
                paymentMethod: po ? po.paymentMethod : 'cash',
                tenor: po ? po.tenor : 0,
                dpPercent: po ? po.dpPercent : 0,
                additionalCost: 0,
                overDeliveryTolerance: po ? po.overDeliveryTolerance : 10
              },
              { transaction: t }
            )

            const replacementItems = resolvedItems
              .filter((r) => r.qty > 0)
              .map((r) => ({
                purchaseOrder: replacementPO.id,
                product: r.item.product,
                ingredient: r.item.ingredient,
                ingredientName: r.item.ingredientName,
                supplier: r.poItem?.supplier || supplier,
                quantity: r.qty,
                unit: r.item.unit || r.poItem?.unit || 'pcs',
                price: r.price,
                total: r.price * r.qty,
                receivedQuantity: 0,
                conversionToBase: Number(r.poItem?.conversionToBase) || 1
              }))

            await db.purchase_order_item.bulkCreate(replacementItems, {
              transaction: t
            })
          }
        }

        await t.commit()

        await createAudit(
          req,
          'update',
          'purchase_return',
          id,
          'Approved purchase return: ' + id + ' (' + resolution + ')'
        )

        return res
          .status(200)
          .json({ success: true, message: 'Purchase return approved', data: ret })
      } catch (err) {
        await t.rollback()
        throw err
      }
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
      const store = req.storeId || req.cookies.store
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
          const qty = Math.floor(Number(item.qty)) || 0
          const product = await db.product.findByPk(item.product, {
            transaction
          })
          if (product) {
            const oldStock = Number(product.stock) || 0
            await product.update(
              { stock: oldStock + qty },
              { transaction }
            )

            // ponytail: atomic upsert + restore per-store stock
            if (ret.store) {
              await db.sequelize.query(
                `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
                 VALUES ($1, $2, 0, NOW(), NOW())
                 ON CONFLICT (product, store) DO NOTHING`,
                { bind: [item.product, ret.store], transaction }
              )
              await db.product_store_stock.update(
                { stock: db.sequelize.literal(`stock + ${qty}`) },
                {
                  where: { product: item.product, store: ret.store },
                  transaction
                }
              )
            }

            await db.stock_history.create(
              {
                product: item.product,
                store: ret.store,
                referenceType: 'adjustment',
                quantityBefore: oldStock,
                quantityChange: qty,
                quantityAfter: oldStock + qty,
                unit: item.unit || 'pcs',
                notes: `Purchase return rejected: ${ret.reason}`,
                createdBy: req.user?.id || null
              },
              { transaction }
            )
          }

          const ingredient = item.ingredient
            ? await db.ingredient.findByPk(item.ingredient, { transaction })
            : item.ingredientName
              ? await db.ingredient.findOne({
                  where: {
                    name: { [Op.iLike]: item.ingredientName.trim() },
                    store: ret.store
                  },
                  transaction
                })
              : null
          if (ingredient) {
            const oldStock = Number(ingredient.stock) || 0
            await ingredient.update(
              { stock: oldStock + qty },
              { transaction }
            )

            await db.stock_history.create(
              {
                ingredient: ingredient.id,
                ingredientName: ingredient.name,
                store: ret.store,
                referenceType: 'adjustment',
                quantityBefore: oldStock,
                quantityChange: qty,
                quantityAfter: oldStock + qty,
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
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
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

      if (po.status !== 'received' && po.status !== 'ordered') {
        return res.status(400).json({
          success: false,
          message: 'Only received or ordered purchase orders can be returned'
        })
      }

      if (!items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one item is required'
        })
      }

      const store = req.storeId || req.cookies.store || po.store

      // Fetch PO items to validate return qty against receivedQty
      const poItems = await db.purchase_order_item.findAll({
        where: { purchaseOrder: poId }
      })

      // Fetch existing return items to compute already-returned qty
      // Note: rejected returns are excluded because they restore stock
      const existingReturns = await db.purchase_return.findAll({
        where: { purchaseOrder: poId, status: { [Op.ne]: 'rejected' } },
        include: [{ model: db.purchase_return_item, as: 'items' }]
      })

      const poItemMap = {}
      poItems.forEach((pi) => {
        const key = pi.ingredient
          ? `ing-${pi.ingredient}`
          : pi.product
            ? `prod-${pi.product}`
            : pi.ingredientName
              ? `name-${pi.ingredientName}`
              : null
        if (key) {
          poItemMap[key] = {
            receivedQty: Number(pi.receivedQuantity) || 0,
            alreadyReturned: 0
          }
        }
      })

      existingReturns.forEach((ret) => {
        ;(ret.items || []).forEach((ri) => {
          const key = ri.ingredient
            ? `ing-${ri.ingredient}`
            : ri.product
              ? `prod-${ri.product}`
              : ri.ingredientName
                ? `name-${ri.ingredientName}`
                : null
          if (key && poItemMap[key]) {
            poItemMap[key].alreadyReturned += Number(ri.qty) || 0
          }
        })
      })

      // Validate each return item
      const errors = []
      for (const item of items) {
        const key = item.ingredient
          ? `ing-${item.ingredient}`
          : item.productId
            ? `prod-${item.productId}`
            : item.ingredientName
              ? `name-${item.ingredientName}`
              : null
        if (key && poItemMap[key]) {
          const info = poItemMap[key]
          const available = info.receivedQty - info.alreadyReturned
          if (Number(item.qty) > available) {
            const name = item.ingredient
              ? `ingredient #${item.ingredient}`
              : item.productId
                ? `product #${item.productId}`
                : `"${item.ingredientName}"`
            errors.push(
              `${name}: max ${available} (received ${info.receivedQty}, already returned ${info.alreadyReturned})`
            )
          }
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Return quantity exceeds available: ${errors.join('; ')}`
        })
      }

      const date = new Date()
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
      const returnNumber = `PR-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${rand}`

      const t = await db.sequelize.transaction()
      try {
        const ret = await db.purchase_return.create(
          {
            purchaseOrder: po.id,
            store,
            returnNumber,
            status: 'pending',
            reason: reason || null,
            returnedBy: returnedBy || null,
            createdBy
          },
          { transaction: t }
        )

        const retItems = items.map((item) => ({
          purchaseReturn: ret.id,
          product: item.productId || null,
          ingredient: item.ingredient || null,
          ingredientName: item.ingredientName || null,
          qty: item.qty,
          unit: item.unit || 'pcs',
          notes: item.notes || null
        }))
        await db.purchase_return_item.bulkCreate(retItems, { transaction: t })

        for (const item of items) {
          if (item.productId) {
            const product = await db.product.findByPk(item.productId, {
              transaction: t
            })
            if (product) {
              const oldStock = Number(product.stock) || 0
              const qty = Math.floor(Number(item.qty)) || 0
              const newStock = Math.max(oldStock - qty, 0)
              await product.update(
                { stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`) },
                { transaction: t }
              )

              // ponytail: atomic upsert + deduct per-store stock
              if (store) {
                await db.sequelize.query(
                  `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
                   VALUES ($1, $2, 0, NOW(), NOW())
                   ON CONFLICT (product, store) DO NOTHING`,
                  { bind: [item.productId, store], transaction: t }
                )
                await db.product_store_stock.update(
                  {
                    stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`)
                  },
                  { where: { product: item.productId, store }, transaction: t }
                )
              }

              await db.stock_history.create(
                {
                  product: item.productId,
                  store,
                  referenceType: 'purchase_return',
                  referenceId: ret.id,
                  quantityBefore: oldStock,
                  quantityChange: -(oldStock - newStock),
                  quantityAfter: newStock,
                  unit: item.unit || 'pcs',
                  createdBy
                },
                { transaction: t }
              )
            }
          }
          if (item.ingredient || (!item.productId && item.ingredientName)) {
            const ingredient = item.ingredient
              ? await db.ingredient.findByPk(item.ingredient, {
                  transaction: t
                })
              : await db.ingredient.findOne({
                  where: { name: item.ingredientName, store },
                  transaction: t
                })
            if (ingredient) {
              const oldStock = Number(ingredient.stock) || 0
              const qty = Math.floor(Number(item.qty)) || 0
              const newStock = Math.max(oldStock - qty, 0)
              await ingredient.update(
                { stock: db.sequelize.literal(`GREATEST(stock - ${qty}, 0)`) },
                { transaction: t }
              )
              await db.stock_history.create(
                {
                  ingredient: ingredient.id,
                  ingredientName: ingredient.name,
                  store,
                  referenceType: 'purchase_return',
                  referenceId: ret.id,
                  quantityBefore: oldStock,
                  quantityChange: -(oldStock - newStock),
                  quantityAfter: newStock,
                  unit: item.unit || ingredient.unit || 'pcs',
                  createdBy
                },
                { transaction: t }
              )
            }
          }
        }

        await t.commit()

        await createAudit(
          req,
          'create',
          'purchase_return',
          ret.id,
          'Created purchase return: ' + ret.id
        )

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
