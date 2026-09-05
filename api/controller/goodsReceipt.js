const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')
const { enrichAuditFields } = require('../../utils/auditFields')
const {
  uploadToCloudinaryWithDedup
} = require('../../utils/cloudinaryStorage')
const batchService = require('../service/batchService')
const { adjustProductStock } = require('../service/stockMutationService')

const generateReceiptNo = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const timestamp = Date.now()
  return `GR-${year}${month}${day}-${timestamp}`
}

// ponytail: multiple documentation photos -> Cloudinary, persisted as JSON array of URLs
// edit mode: req.body.documentation may carry kept old URLs (JSON array string) to merge
const uploadDocumentation = async (req) => {
  const files = []
  if (Array.isArray(req.files) && req.files.length > 0) files.push(...req.files)
  else if (req.file) files.push(req.file)

  let keptUrls = []
  const bodyDoc = req.body?.documentation
  if (Array.isArray(bodyDoc)) {
    keptUrls = bodyDoc.filter(Boolean)
  } else if (typeof bodyDoc === 'string' && bodyDoc.trim().startsWith('[')) {
    try {
      const arr = JSON.parse(bodyDoc)
      if (Array.isArray(arr)) keptUrls = arr.filter(Boolean)
    } catch {
      // not a JSON array -> treat as single legacy URL
      if (!files.length && bodyDoc.trim()) return bodyDoc
    }
  }

  if (files.length === 0 && keptUrls.length === 0) {
    // explicit clear / legacy single URL / field absent semantics
    if (bodyDoc === null) return null
    if (typeof bodyDoc === 'string') return bodyDoc || null
    return undefined
  }

  const urls = [...keptUrls]
  for (const f of files) {
    try {
      const { url } = await uploadToCloudinaryWithDedup(
        f.path,
        'pos-app-goods-receipts'
      )
      urls.push(url)
    } catch (cloudErr) {
      console.error(
        'Documentation upload skipped (Cloudinary not configured):',
        cloudErr.message
      )
    }
  }
  return urls.length > 0 ? JSON.stringify(urls) : null
}

// ponytail: allocate GR shipping cost proportionally across received lines
const getShippingShare = (shippingCost, poItemPrice, totalPOValue) => {
  const shipping = Number(shippingCost) || 0
  if (
    shipping <= 0 ||
    totalPOValue <= 0 ||
    !poItemPrice ||
    Number(poItemPrice) <= 0
  )
    return 0
  return Math.round((shipping * Number(poItemPrice)) / totalPOValue)
}

const picInclude = {
  model: db.user,
  as: 'picData',
  attributes: ['id', 'fullName', 'userName']
}

// ponytail: weighted-average HPP update when GR costPrice differs from PO price
const applyCostPrice = async ({ item, qty, store, transaction }) => {
  const costPrice = parseInt(item.costPrice) || 0
  const conversion = Number(item.conversionToBase) || 1
  const qtyStock = qty * conversion
  // HPP is per PO unit; convert to per base-stock-unit before averaging
  const baseUnitCost = conversion > 0 ? costPrice / conversion : 0
  if (baseUnitCost <= 0 || qtyStock <= 0) return

  if (item.product) {
    const product = await db.product.findByPk(item.product, { transaction })
    if (product) {
      const oldStock = Number(product.stock) || 0
      const oldCost = Number(product.costPrice) || 0
      const newCost = Math.round(
        (oldStock * oldCost + qtyStock * baseUnitCost) / (oldStock + qtyStock)
      )
      await product.update({ costPrice: newCost }, { transaction })
    }
  }

  const ingName = item.ingredientName || item.poItemData?.ingredientName
  if (ingName) {
    const ingredient = await db.ingredient.findOne({
      where: { name: { [Op.iLike]: ingName.trim() }, store },
      transaction
    })
    if (ingredient) {
      const oldStock = Number(ingredient.stock) || 0
      const oldCost = Number(ingredient.costPrice) || 0
      const newCost = Math.round(
        (oldStock * oldCost + qtyStock * baseUnitCost) / (oldStock + qtyStock)
      )
      await ingredient.update({ costPrice: newCost }, { transaction })
    }
  }
}

const reverseStock = async (items, store, transaction, userId) => {
  for (const grItem of items) {
    const qty = parseInt(grItem.qtyReceived) || 0
    if (qty <= 0) continue

    const qtyStock =
      Number(grItem.qtyStock) > 0
        ? Number(grItem.qtyStock)
        : qty * (Number(grItem.conversionToBase) || 1)

    if (grItem.purchaseOrderItem) {
      await db.purchase_order_item.update(
        {
          receivedQuantity: db.sequelize.literal(
            `GREATEST("receivedQuantity" - ${qty}, 0)`
          )
        },
        { where: { id: grItem.purchaseOrderItem }, transaction }
      )
    }

    if (grItem.product) {
      // Locked, atomic delta via the shared helper — previously this
      // computed the new value in JS from an unlocked read
      // (product.stock: Math.max(qtyBefore - qtyStock, 0)) and wrote it
      // as an absolute value, a lost-update race under any concurrent
      // writer to the same product (e.g. a sale finishing at the same
      // moment this reversal commits).
      await adjustProductStock({
        productId: grItem.product,
        store: store || null,
        deltaQty: -qtyStock,
        referenceType: 'adjustment',
        notes: `GR reversal: ${grItem.id || 'update'}`,
        createdBy: userId || null,
        transaction
      })
    }

    const ingName =
      grItem.ingredientName ||
      grItem.poItemData?.ingredientName ||
      grItem.poItemData?.ingredientData?.name
    if (ingName) {
      const ingredient = await db.ingredient.findOne({
        where: {
          name: { [Op.iLike]: ingName.trim() },
          store: store || null
        },
        transaction
      })
      if (ingredient) {
        const qtyBefore = Number(ingredient.stock) || 0
        await ingredient.update(
          { stock: Math.max(qtyBefore - qtyStock, 0) },
          { transaction }
        )
        await db.stock_history.create(
          {
            ingredient: ingredient.id,
            ingredientName: ingredient.name,
            store: store || null,
            referenceType: 'adjustment',
            quantityBefore: qtyBefore,
            quantityChange: -qtyStock,
            quantityAfter: Math.max(qtyBefore - qtyStock, 0),
            unit: ingredient.unit || grItem.unit || 'pcs',
            notes: `GR reversal: ${grItem.id || 'update'}`,
            createdBy: userId || null
          },
          { transaction }
        )
      }
    }
  }
}

const applyStock = async (items, receipt, transaction, userId) => {
  for (const item of items) {
    const qty = parseInt(item.qtyReceived) || 0
    if (qty <= 0) continue

    const conversion =
      Number(item.conversionToBase) ||
      Number(item.poItemData?.conversionToBase) ||
      1
    const qtyStock = qty * conversion

    if (item.purchaseOrderItem) {
      await db.purchase_order_item.update(
        {
          receivedQuantity: db.sequelize.literal(`"receivedQuantity" + ${qty}`)
        },
        {
          where: {
            id: item.purchaseOrderItem,
            purchaseOrder: receipt.purchaseOrderId
          },
          transaction
        }
      )
    }

    if (item.product) {
      const product = await db.product.findByPk(item.product, { transaction })
      if (product) {
        const qtyBefore = Number(product.stock) || 0
        await product.update(
          { stock: db.sequelize.literal(`stock + ${qtyStock}`) },
          { transaction }
        )

        // ponytail: atomic upsert + add per-store stock
        if (receipt.store) {
          await db.sequelize.query(
            `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
               VALUES ($1, $2, 0, NOW(), NOW())
               ON CONFLICT (product, store) DO NOTHING`,
            { bind: [item.product, receipt.store], transaction }
          )
          await db.product_store_stock.update(
            { stock: db.sequelize.literal(`stock + ${qtyStock}`) },
            {
              where: { product: item.product, store: receipt.store },
              transaction
            }
          )
        }

        await db.stock_history.create(
          {
            product: item.product,
            store: receipt.store,
            referenceType: 'purchase',
            quantityBefore: qtyBefore,
            quantityChange: qtyStock,
            quantityAfter: qtyBefore + qtyStock,
            unit: product.unit || item.unit || 'pcs',
            notes: `GR: ${receipt.receiptNumber} (PO: ${receipt.purchaseOrderId})`,
            createdBy: userId || null
          },
          { transaction }
        )
      }
    }

    const ingName =
      item.ingredientName ||
      item.poItemData?.ingredientName ||
      item.poItemData?.ingredientData?.name
    if (ingName) {
      const ingredient = await db.ingredient.findOne({
        where: { name: { [Op.iLike]: ingName.trim() }, store: receipt.store },
        transaction
      })
      if (ingredient) {
        const qtyBefore = Number(ingredient.stock) || 0
        await ingredient.update(
          { stock: db.sequelize.literal(`stock + ${qtyStock}`) },
          { transaction }
        )
        await db.stock_history.create(
          {
            ingredient: ingredient.id,
            ingredientName: ingredient.name,
            store: receipt.store,
            referenceType: 'purchase',
            quantityBefore: qtyBefore,
            quantityChange: qtyStock,
            quantityAfter: qtyBefore + qtyStock,
            unit: ingredient.unit || item.unit || 'pcs',
            notes: `GR: ${receipt.receiptNumber} (PO: ${receipt.purchaseOrderId})`,
            createdBy: userId || null
          },
          { transaction }
        )
      }
    }

    await applyCostPrice({
      item,
      qty,
      store: receipt.store,
      transaction
    })
  }
}

const goodsReceiptController = {
  async getAll(req, res) {
    try {
      const store = req.storeId || req.cookies.store
      const userRole = req.user?.roleType
      const {
        page = 1,
        limit = 10,
        status,
        poId,
        startDate,
        endDate,
        store: queryStore,
        search
      } = req.query

      const where = {}
      if (queryStore && userRole === 'super_admin') where.store = queryStore
      else if (store && userRole !== 'super_admin') where.store = store
      if (status) where.status = status
      if (poId) where.purchaseOrderId = poId
      if (search) {
        where[Op.or] = [
          { receiptNumber: { [Op.iLike]: `%${search}%` } },
          { notes: { [Op.iLike]: `%${search}%` } },
          { '$purchaseOrderData.orderNumber$': { [Op.iLike]: `%${search}%` } }
        ]
      }
      if (startDate || endDate) {
        where.receivedDate = {}
        if (startDate) where.receivedDate[Op.gte] = new Date(startDate)
        if (endDate) where.receivedDate[Op.lte] = new Date(endDate)
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const { count, rows } = await db.goodsReceipt.findAndCountAll({
        where,
        distinct: true,
        include: [
          {
            model: db.purchase_order,
            as: 'purchaseOrderData',
            attributes: ['id', 'orderNumber', 'status']
          },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] },
          picInclude,
          { model: db.goodsReceiptItem, as: 'items' }
        ],
        order: [['updatedAt', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      await enrichAuditFields(db, rows)

      const stats = {
        total: count,
        draft: await db.goodsReceipt.count({
          where: { ...where, status: 'draft' }
        }),
        completed: await db.goodsReceipt.count({
          where: { ...where, status: 'completed' }
        }),
        cancelled: await db.goodsReceipt.count({
          where: { ...where, status: 'cancelled' }
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success',
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        },
        stats
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

      const receipt = await db.goodsReceipt.findOne({
        where,
        include: [
          {
            model: db.purchase_order,
            as: 'purchaseOrderData',
            attributes: ['id', 'orderNumber', 'status']
          },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] },
          picInclude,
          {
            model: db.goodsReceiptItem,
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

      if (!receipt) {
        return res
          .status(404)
          .json({ success: false, message: 'Goods receipt not found' })
      }

      let poItems = []
      if (receipt.purchaseOrderId) {
        poItems = await db.purchase_order_item.findAll({
          where: { purchaseOrder: receipt.purchaseOrderId }
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success',
        data: {
          ...receipt.toJSON(),
          purchaseOrderItems: poItems
        }
      })
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
      const store = req.storeId || req.cookies.store
      const userRole = req.user?.roleType

      const where = { purchaseOrderId: poId }
      if (store && userRole !== 'super_admin') where.store = store

      const receipts = await db.goodsReceipt.findAll({
        where,
        include: [
          { model: db.goodsReceiptItem, as: 'items' },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
        ],
        order: [['createdAt', 'DESC']]
      })

      return res.status(200).json({
        success: true,
        message: 'Success',
        data: receipts
      })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async create(req, res) {
    try {
      const store = req.storeId || req.cookies.store
      const {
        purchaseOrderId,
        items,
        receivedDate,
        notes,
        pic,
        suratJalan,
        taxInvoiceNo,
        shippingCost
      } = req.body

      if (!purchaseOrderId || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Purchase order and items are required'
        })
      }

      // ponytail: documentation photos -> Cloudinary (JSON array)
      let documentation = req.body.documentation || null
      const uploadedDocs = await uploadDocumentation(req)
      if (uploadedDocs !== undefined) documentation = uploadedDocs

      // ponytail: reject duplicate ingredients/products in same GR
      const keys = items
        .map((i) =>
          i.ingredient
            ? `ing-${i.ingredient}`
            : i.product
              ? `prod-${i.product}`
              : null
        )
        .filter(Boolean)
      const dupes = keys.filter((k, i) => keys.indexOf(k) !== i)
      if (dupes.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Duplicate item(s) in goods receipt: ${[...new Set(dupes)].join(', ')}`
        })
      }

      const poWhere = { id: purchaseOrderId }
      if (store) poWhere.store = store

      const po = await db.purchase_order.findOne({
        where: poWhere
      })

      if (!po) {
        return res
          .status(404)
          .json({ success: false, message: 'Purchase order not found' })
      }

      if (po.status === 'cancelled') {
        return res
          .status(400)
          .json({ success: false, message: 'Cannot receive cancelled order' })
      }

      // ponytail: credit control - block GR until DP is fully paid
      if (po.paymentMethod === 'credit') {
        const dpAmount =
          (Number(po.dpPercent || 0) / 100) * Number(po.finalAmount || 0)
        const paidToPO =
          (await db.purchase_payment.sum('amount', {
            where: { purchaseOrder: purchaseOrderId, deletedAt: null }
          })) || 0
        if (paidToPO < dpAmount) {
          return res.status(400).json({
            success: false,
            message: `DP belum lunas. DP: Rp ${dpAmount.toLocaleString('id-ID')}, Dibayar: Rp ${paidToPO.toLocaleString('id-ID')}`
          })
        }
      }

      const receiptNumber = generateReceiptNo()
      const effectiveStore = store || po.store

      const transaction = await db.sequelize.transaction()

      try {
        const receipt = await db.goodsReceipt.create(
          {
            store: effectiveStore,
            receiptNumber,
            purchaseOrderId,
            receivedDate: receivedDate || new Date(),
            status: req.body.status || 'completed',
            notes,
            pic: pic || null,
            documentation,
            suratJalan: suratJalan || null,
            taxInvoiceNo: taxInvoiceNo || null,
            shippingCost: Number(shippingCost) || 0,
            createdBy: req.user?.id || null
          },
          { transaction }
        )

        const receiptItems = []
        const additionalCost = Number(po.additionalCost) || 0
        const tolerance = Number(po.overDeliveryTolerance) || 10
        const allPoItems = await db.purchase_order_item.findAll({
          where: { purchaseOrder: purchaseOrderId },
          transaction
        })
        const totalPOValue = allPoItems.reduce(
          (sum, pi) => sum + Number(pi.quantity) * Number(pi.price),
          0
        )

        // Build lookup maps from the PO items already fetched above, and
        // bulk-fetch every distinct product referenced by this receipt's
        // lines — replaces up to 2 findOne/findByPk calls per line with
        // in-memory lookups against data already loaded in this transaction.
        const poItemById = new Map(allPoItems.map((pi) => [pi.id, pi]))
        const poItemByIngredient = new Map(
          allPoItems.filter((pi) => pi.ingredient).map((pi) => [pi.ingredient, pi])
        )
        const poItemByIngredientName = new Map(
          allPoItems
            .filter((pi) => pi.ingredientName)
            .map((pi) => [pi.ingredientName, pi])
        )
        const receiptProductIds = [
          ...new Set(items.map((it) => it.product).filter(Boolean))
        ]
        const receiptProducts = receiptProductIds.length
          ? await db.product.findAll({
              where: { id: receiptProductIds },
              transaction
            })
          : []
        const productById = new Map(receiptProducts.map((p) => [p.id, p]))

        for (const [index, item] of items.entries()) {
          const qty = parseInt(item.qtyReceived) || 0
          if (qty <= 0) continue

          // Over-receive validation
          let poItem = null
          if (item.purchaseOrderItem) {
            poItem = poItemById.get(Number(item.purchaseOrderItem)) || null
          } else if (item.ingredient && purchaseOrderId) {
            poItem = poItemByIngredient.get(item.ingredient) || null
          } else if (item.ingredientName && purchaseOrderId) {
            poItem = poItemByIngredientName.get(item.ingredientName) || null
          }

          if (poItem) {
            const ordered = Number(poItem.quantity)
            const alreadyReceived = Number(poItem.receivedQuantity) || 0
            const toleranceQty = Math.ceil((ordered * tolerance) / 100)
            const maxDeliverable = ordered + toleranceQty
            const remaining = maxDeliverable - alreadyReceived
            if (qty > remaining) {
              await transaction.rollback()
              return res.status(400).json({
                success: false,
                message: `Over-receiving not allowed for ${item.ingredientName || poItem.ingredientName || 'item'}: max ${remaining} remaining (ordered ${ordered}, tolerance ${tolerance}% = +${toleranceQty}, already received ${alreadyReceived})`
              })
            }
          }

          const conversion =
            Number(item.conversionToBase) ||
            Number(poItem?.conversionToBase) ||
            1
          const baseCost =
            parseInt(item.costPrice) || (poItem ? Number(poItem.price) || 0 : 0)
          const landed =
            additionalCost > 0 && totalPOValue > 0 && poItem
              ? Math.round(
                  (additionalCost * (Number(poItem.price) || 0)) / totalPOValue
                )
              : 0
          const shippingShare = getShippingShare(
            shippingCost,
            poItem?.price,
            totalPOValue
          )
          const costPrice = baseCost + landed + shippingShare
          const qtyStock = qty * conversion

          receiptItems.push({
            goodsReceipt: receipt.id,
            purchaseOrderItem: item.purchaseOrderItem || poItem?.id || null,
            product: item.product || null,
            qtyReceived: qty,
            unit: item.unit || 'pcs',
            conditionNotes: item.conditionNotes || null,
            ingredientName: item.ingredientName || null,
            batchNumber: item.batchNumber || null,
            expiryDate: item.expiryDate || null,
            costPrice,
            landedCost: landed,
            conversionToBase: conversion,
            qtyStock
          })

          if (poItem) {
            await poItem.update(
              {
                receivedQuantity: db.sequelize.literal(
                  `"receivedQuantity" + ${qty}`
                )
              },
              { transaction }
            )
          }

          if (item.product) {
            const product = productById.get(item.product)
            if (product) {
              const qtyBefore = Number(product.stock) || 0
              await product.update(
                { stock: db.sequelize.literal(`stock + ${qtyStock}`) },
                { transaction }
              )

              // ponytail: atomic upsert + add per-store stock
              if (effectiveStore) {
                await db.sequelize.query(
                  `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
                   VALUES ($1, $2, 0, NOW(), NOW())
                   ON CONFLICT (product, store) DO NOTHING`,
                  { bind: [item.product, effectiveStore], transaction }
                )
                await db.product_store_stock.update(
                  { stock: db.sequelize.literal(`stock + ${qtyStock}`) },
                  {
                    where: { product: item.product, store: effectiveStore },
                    transaction
                  }
                )
              }

              await db.stock_history.create(
                {
                  product: item.product,
                  store: effectiveStore,
                  referenceType: 'purchase',
                  quantityBefore: qtyBefore,
                  quantityChange: qtyStock,
                  quantityAfter: qtyBefore + qtyStock,
                  unit: product.unit || item.unit || 'pcs',
                  notes: `GR: ${receiptNumber} (PO: ${po.orderNumber})`,
                  createdBy: req.user?.id || null
                },
                { transaction }
              )

              // ponytail: FIFO - create batch + per-store batch stock per GR line
              const baseUnitCost = conversion > 0 ? costPrice / conversion : 0
              await batchService.addBatchStock({
                productId: item.product,
                store: effectiveStore,
                qty: qtyStock,
                costPerUnit: baseUnitCost,
                batchCode:
                  item.batchNumber || `${receiptNumber}-${index + 1}`,
                expiryDate: item.expiryDate || null,
                supplier: po.supplier || null,
                receivedDate: receivedDate || new Date(),
                transaction
              })
            }
          }

          if (item.ingredientName) {
            const ingredient = await db.ingredient.findOne({
              where: {
                name: { [Op.iLike]: item.ingredientName.trim() },
                store: effectiveStore
              },
              transaction
            })

            if (ingredient) {
              const qtyBefore = Number(ingredient.stock) || 0
              await ingredient.update(
                { stock: db.sequelize.literal(`stock + ${qtyStock}`) },
                { transaction }
              )

              await db.stock_history.create(
                {
                  ingredient: ingredient.id,
                  ingredientName: ingredient.name,
                  store: effectiveStore,
                  referenceType: 'purchase',
                  quantityBefore: qtyBefore,
                  quantityChange: qtyStock,
                  quantityAfter: qtyBefore + qtyStock,
                  unit: ingredient.unit || item.unit || 'pcs',
                  notes: `GR: ${receiptNumber} (PO: ${po.orderNumber})`,
                  createdBy: req.user?.id || null
                },
                { transaction }
              )
            }
          }

          await applyCostPrice({
            item: { ...item, costPrice, conversionToBase: conversion },
            qty,
            store: effectiveStore,
            transaction
          })
        }

        if (receiptItems.length > 0) {
          await db.goodsReceiptItem.bulkCreate(receiptItems, { transaction })
        }

        // ponytail: re-fetch so receivedQuantity reflects this receipt
        const freshPoItems = await db.purchase_order_item.findAll({
          where: { purchaseOrder: purchaseOrderId },
          transaction
        })
        const allReceived = freshPoItems.every(
          (pi) => Number(pi.receivedQuantity) >= Number(pi.quantity)
        )

        if (allReceived) {
          await po.update(
            { status: 'received', receivedDate: receivedDate || new Date() },
            { transaction }
          )
        } else {
          await po.update({ status: 'ordered' }, { transaction })
        }

        await transaction.commit()

        const created = await db.goodsReceipt.findByPk(receipt.id, {
          include: [{ model: db.goodsReceiptItem, as: 'items' }]
        })

        if ((req.body.status || 'completed') === 'completed') {
          try {
            const {
              postPurchaseJournal
            } = require('../service/accountingService')
            await postPurchaseJournal({
              store: effectiveStore,
              receiptId: receipt.id,
              receiptNumber,
              poId: purchaseOrderId,
              poNumber: po.orderNumber,
              totalAmount: po.totalAmount,
              discount: po.discount,
              items: created.items || [],
              date: receivedDate || new Date(),
              createdBy: req.user?.id
            })
          } catch (e) {
            console.error('Purchase journal skipped:', e.message)
          }
        }

        await createAudit(
          req,
          'create',
          'goods_receipt',
          receipt.id,
          'Created goods_receipt: ' + receipt.id
        )

        return res.status(201).json({
          success: true,
          message: 'Success create goods receipt',
          data: created
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

  async exportExcel(req, res) {
    try {
      const store = req.storeId || req.cookies.store
      const userRole = req.user?.roleType
      const { status, startDate, endDate, store: queryStore } = req.query

      const where = {}
      if (queryStore && userRole === 'super_admin') where.store = queryStore
      else if (store && userRole !== 'super_admin') where.store = store
      if (status) where.status = status
      if (startDate || endDate) {
        where.receivedDate = {}
        if (startDate) where.receivedDate[Op.gte] = new Date(startDate)
        if (endDate) where.receivedDate[Op.lte] = new Date(endDate)
      }

      const rows = await db.goodsReceipt.findAll({
        where,
        include: [
          {
            model: db.purchase_order,
            as: 'purchaseOrderData',
            attributes: ['id', 'orderNumber', 'status']
          },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] },
          { model: db.goodsReceiptItem, as: 'items' }
        ],
        order: [['createdAt', 'DESC']]
      })

      return res.status(200).json({
        success: true,
        message: 'Success',
        data: rows
      })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params
      const store = req.storeId || req.cookies.store
      const userRole = req.user?.roleType
      const {
        notes,
        receivedDate,
        items,
        status,
        pic,
        suratJalan,
        taxInvoiceNo,
        shippingCost
      } = req.body

      // ponytail: documentation photos -> Cloudinary (or explicit null to clear)
      let documentation
      const uploadedDocs = await uploadDocumentation(req)
      if (uploadedDocs !== undefined) {
        documentation = uploadedDocs
      } else if (req.body.documentation !== undefined) {
        documentation = req.body.documentation
      }

      const where = { id }
      if (store && userRole !== 'super_admin') where.store = store

      const receipt = await db.goodsReceipt.findOne({
        where,
        include: [
          {
            model: db.goodsReceiptItem,
            as: 'items',
            include: [
              {
                model: db.purchase_order_item,
                as: 'poItemData',
                include: [
                  {
                    model: db.ingredient,
                    as: 'ingredientData',
                    attributes: ['id', 'name']
                  }
                ]
              }
            ]
          }
        ]
      })

      if (!receipt) {
        return res
          .status(404)
          .json({ success: false, message: 'Goods receipt not found' })
      }

      if (receipt.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: 'Only draft receipt can be updated'
        })
      }

      // ponytail: reject duplicate ingredients/products in same GR
      if (items) {
        const keys = items
          .map((i) =>
            i.ingredient
              ? `ing-${i.ingredient}`
              : i.product
                ? `prod-${i.product}`
                : null
          )
          .filter(Boolean)
        const dupes = keys.filter((k, i) => keys.indexOf(k) !== i)
        if (dupes.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Duplicate item(s) in goods receipt: ${[...new Set(dupes)].join(', ')}`
          })
        }
      }

      const oldItems = receipt.items || []

      const transaction = await db.sequelize.transaction()
      try {
        await reverseStock(
          oldItems,
          store || receipt.store,
          transaction,
          req.user?.id
        )

        await receipt.update(
          {
            notes: notes !== undefined ? notes : receipt.notes,
            receivedDate: receivedDate || receipt.receivedDate,
            status: status || receipt.status,
            pic: pic !== undefined ? pic : receipt.pic,
            documentation:
              documentation !== undefined ? documentation : receipt.documentation,
            suratJalan:
              suratJalan !== undefined ? suratJalan : receipt.suratJalan,
            taxInvoiceNo:
              taxInvoiceNo !== undefined ? taxInvoiceNo : receipt.taxInvoiceNo,
            shippingCost:
              shippingCost !== undefined
                ? Number(shippingCost) || 0
                : Number(receipt.shippingCost) || 0,
            modifiedBy: req.user?.id || null
          },
          { transaction }
        )

        await db.goodsReceiptItem.destroy({
          where: { goodsReceipt: id },
          transaction
        })

        if (items && items.length > 0) {
          const po = await db.purchase_order.findOne({
            where: { id: receipt.purchaseOrderId }
          })
          const additionalCost = Number(po?.additionalCost) || 0
          const tolerance = Number(po?.overDeliveryTolerance) || 10
          const allPoItems = await db.purchase_order_item.findAll({
            where: { purchaseOrder: receipt.purchaseOrderId },
            transaction
          })
          const totalPOValue = allPoItems.reduce(
            (sum, pi) => sum + Number(pi.quantity) * Number(pi.price),
            0
          )

          const newItems = []
          for (const item of items) {
            const qty = parseInt(item.qtyReceived)
            if (qty <= 0) continue

            let poItem =
              allPoItems.find((pi) => pi.id === item.purchaseOrderItem) || null
            if (!poItem && item.ingredient) {
              poItem =
                allPoItems.find((pi) => pi.ingredient === item.ingredient) ||
                null
            }
            if (!poItem && item.ingredientName) {
              poItem =
                allPoItems.find(
                  (pi) => pi.ingredientName === item.ingredientName
                ) || null
            }

            if (poItem) {
              const ordered = Number(poItem.quantity)
              const alreadyReceived = Number(poItem.receivedQuantity) || 0
              const toleranceQty = Math.ceil((ordered * tolerance) / 100)
              const maxDeliverable = ordered + toleranceQty
              const remaining = maxDeliverable - alreadyReceived
              if (qty > remaining) {
                await transaction.rollback()
                return res.status(400).json({
                  success: false,
                  message: `Over-receiving not allowed for ${item.ingredientName || poItem.ingredientName || 'item'}: max ${remaining} remaining (ordered ${ordered}, tolerance ${tolerance}%, already received ${alreadyReceived})`
                })
              }
            }

            const conversion =
              Number(item.conversionToBase) ||
              Number(poItem?.conversionToBase) ||
              1
            const baseCost =
              parseInt(item.costPrice) ||
              (poItem ? Number(poItem.price) || 0 : 0)
            const landed =
              additionalCost > 0 && totalPOValue > 0 && poItem
                ? Math.round(
                    (additionalCost * (Number(poItem.price) || 0)) /
                      totalPOValue
                  )
                : 0
            const shippingShare = getShippingShare(
              shippingCost !== undefined ? shippingCost : receipt.shippingCost,
              poItem?.price,
              totalPOValue
            )
            const costPrice = baseCost + landed + shippingShare

            newItems.push({
              goodsReceipt: id,
              purchaseOrderItem: item.purchaseOrderItem || poItem?.id || null,
              product: item.product || null,
              qtyReceived: qty,
              unit: item.unit || 'pcs',
              conditionNotes: item.conditionNotes || null,
              ingredientName: item.ingredientName || null,
              batchNumber: item.batchNumber || null,
              expiryDate: item.expiryDate || null,
              costPrice,
              landedCost: landed,
              conversionToBase: conversion,
              qtyStock: qty * conversion
            })
          }

          if (newItems.length > 0) {
            await db.goodsReceiptItem.bulkCreate(newItems, { transaction })
            await applyStock(newItems, receipt, transaction, req.user?.id)
          }
        }

        await transaction.commit()
      } catch (err) {
        await transaction.rollback()
        throw err
      }

      const updated = await db.goodsReceipt.findByPk(receipt.id, {
        include: [{ model: db.goodsReceiptItem, as: 'items' }]
      })

      await createAudit(
        req,
        'update',
        'goods_receipt',
        id,
        'Updated goods_receipt: ' + id
      )

      return res.status(200).json({
        success: true,
        message: 'Success update goods receipt',
        data: updated
      })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params
      const store = req.storeId || req.cookies.store
      const userRole = req.user?.roleType

      const where = { id }
      if (store && userRole !== 'super_admin') where.store = store

      const receipt = await db.goodsReceipt.findOne({
        where,
        include: [
          {
            model: db.goodsReceiptItem,
            as: 'items',
            include: [
              {
                model: db.purchase_order_item,
                as: 'poItemData',
                include: [
                  {
                    model: db.ingredient,
                    as: 'ingredientData',
                    attributes: ['id', 'name']
                  }
                ]
              }
            ]
          }
        ]
      })
      if (!receipt) {
        return res
          .status(404)
          .json({ success: false, message: 'Goods receipt not found' })
      }

      if (receipt.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: 'Only draft receipt can be deleted'
        })
      }

      const transaction = await db.sequelize.transaction()
      try {
        const oldItems = receipt.items || []
        await reverseStock(
          oldItems,
          store || receipt.store,
          transaction,
          req.user?.id
        )

        await db.goodsReceiptItem.destroy({
          where: { goodsReceipt: id },
          transaction
        })
        await receipt.destroy({ transaction })
        await transaction.commit()
      } catch (err) {
        await transaction.rollback()
        throw err
      }

      await createAudit(
        req,
        'delete',
        'goods_receipt',
        id,
        'Deleted goods_receipt: ' + id
      )

      return res
        .status(200)
        .json({ success: true, message: 'Success delete goods receipt' })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async changeStatus(req, res) {
    try {
      const { id } = req.params
      const { status } = req.body
      const store = req.storeId || req.cookies.store
      const userRole = req.user?.roleType

      if (!['completed', 'cancelled'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be "completed" or "cancelled"'
        })
      }

      const where = { id }
      if (store && userRole !== 'super_admin') where.store = store

      const receipt = await db.goodsReceipt.findOne({
        where,
        include: [
          {
            model: db.goodsReceiptItem,
            as: 'items',
            include: [
              {
                model: db.purchase_order_item,
                as: 'poItemData',
                include: [
                  {
                    model: db.ingredient,
                    as: 'ingredientData',
                    attributes: ['id', 'name']
                  }
                ]
              }
            ]
          }
        ]
      })
      if (!receipt) {
        return res
          .status(404)
          .json({ success: false, message: 'Goods receipt not found' })
      }

      if (receipt.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: `Cannot change status from "${receipt.status}"`
        })
      }

      const transaction = await db.sequelize.transaction()
      try {
        if (status === 'completed') {
          const items = (receipt.items || []).map((i) => ({
            ...i.toJSON(),
            purchaseOrderItem: i.purchaseOrderItem,
            product: i.product,
            qtyReceived: i.qtyReceived,
            unit: i.unit,
            ingredientName: i.ingredientName
          }))
          await applyStock(items, receipt, transaction, req.user?.id)
        }

        await receipt.update(
          {
            status,
            modifiedBy: req.user?.id || null,
            receivedDate:
              status === 'completed' ? new Date() : receipt.receivedDate
          },
          { transaction }
        )
        await transaction.commit()
      } catch (err) {
        await transaction.rollback()
        throw err
      }

      await createAudit(
        req,
        'update',
        'goods_receipt',
        id,
        'Changed goods_receipt status to ' + status + ': ' + id
      )

      if (status === 'completed') {
        try {
          const po = await db.purchase_order.findByPk(receipt.purchaseOrderId)
          const {
            postPurchaseJournal
          } = require('../service/accountingService')
          await postPurchaseJournal({
            store: receipt.store,
            receiptId: receipt.id,
            receiptNumber: receipt.receiptNumber,
            poId: receipt.purchaseOrderId,
            poNumber: po?.orderNumber,
            totalAmount: po?.totalAmount,
            discount: po?.discount,
            items: receipt.items || [],
            date: new Date(),
            createdBy: req.user?.id
          })
        } catch (e) {
          console.error('Purchase journal skipped:', e.message)
        }
      }

      return res.status(200).json({
        success: true,
        message: `Status changed to "${status}"`,
        data: receipt
      })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  }
}

module.exports = goodsReceiptController
