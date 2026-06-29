const db = require('../../db/models')
const Order = db.order
const OrderItem = db.order_item
const OrderStatus = db.order_status
const Table = db.table
const Product = db.product
const Discount = db.discount
const Transaction = db.transaction
const BestSelling = db.best_selling
const { createNotification } = require('../../utils/createNotification')
const { createAudit } = require('../../utils/auditLog')
const { emitItemStatusUpdate, emitNewOrder } = require('../service/socket')

const generateOrderNumber = () => {
  const date = new Date()
  const timestamp = date.getTime().toString().slice(-8)
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ORD${timestamp}${random}`
}

const getActiveTaxRate = async (store) => {
  try {
    const taxConfigs = await db.taxConfig.findAll({
      where: { store, status: 'active' },
      attributes: ['rate']
    })
    if (taxConfigs.length > 0) {
      return taxConfigs.reduce((sum, t) => sum + Number(t.rate), 0)
    }
  } catch (e) {
    console.error('Error fetching tax config:', e.message)
  }
  return 11 // fallback default
}

const getServiceChargeRate = async (store) => {
  // Could be extended to a service_charge_config table
  return 5
}

const applyAdvancedPromo = async (items, discount) => {
  if (!discount || !discount.conditions || !discount.conditions.promoType)
    return 0
  const { promoType } = discount.conditions
  let totalDiscount = 0

  // ponytail: normalise field names from different payload formats
  items.forEach((item) => {
    item.productId = item.productId || item.product
    item.unitPrice = item.unitPrice ?? item.price ?? item.basePrice ?? 0
  })

  switch (promoType) {
    case 'bogo': {
      const {
        buyQty = 2,
        freeQty = 1,
        freeProductId = null
      } = discount.conditions
      let targetItem
      if (freeProductId) {
        targetItem = items.find(
          (i) => Number(i.productId) === Number(freeProductId)
        )
      } else {
        targetItem = items.reduce((a, b) =>
          (a.unitPrice || 0) < (b.unitPrice || 0) ? a : b
        )
      }
      if (targetItem && targetItem.quantity >= buyQty) {
        const freeCount = Math.floor(targetItem.quantity / buyQty) * freeQty
        const freeAmount = (targetItem.unitPrice || 0) * freeCount
        targetItem.subtotal = Math.max(
          0,
          (targetItem.unitPrice || 0) * targetItem.quantity - freeAmount
        )
        totalDiscount += freeAmount
      }
      break
    }
    case 'bundling': {
      const { bundlePrice, productIds } = discount.conditions
      const pidSet = new Set((productIds || []).map(Number))
      const bundleItems = items.filter((i) => pidSet.has(Number(i.productId)))
      if (bundleItems.length === (productIds || []).length) {
        const origTotal = bundleItems.reduce((s, i) => s + i.subtotal, 0)
        const ratio = bundlePrice / origTotal
        bundleItems.forEach((item) => {
          const orig = item.subtotal
          item.subtotal = Math.round(orig * ratio)
          totalDiscount += orig - item.subtotal
        })
      }
      break
    }
    case 'category': {
      const { discountPercent, categoryIds } = discount.conditions
      const catSet = new Set((categoryIds || []).map(Number))
      for (const item of items) {
        let catId = Number(item.categoryId)
        if (!catId) {
          const prod = await Product.findByPk(item.productId, {
            attributes: ['category']
          })
          if (prod) catId = Number(prod.category)
        }
        if (catSet.has(catId)) {
          const disc = Math.round(item.subtotal * (discountPercent / 100))
          item.subtotal -= disc
          totalDiscount += disc
        }
      }
      break
    }
  }
  return totalDiscount
}

const calculateOrderTotals = (
  items,
  discountValue = 0,
  discountType = 'none',
  taxRate = 0,
  serviceChargeRate = 0
) => {
  let subTotal = 0
  let totalQuantity = 0

  items.forEach((item) => {
    subTotal += item.subtotal
    totalQuantity += item.quantity
  })

  let discountAmount = 0
  if (discountType === 'percent') {
    discountAmount = Math.round(subTotal * (discountValue / 100))
  } else if (discountType === 'nominal') {
    discountAmount = discountValue
  }

  const afterDiscount = subTotal - discountAmount
  const taxAmount = Math.round(afterDiscount * (taxRate / 100))
  const serviceChargeAmount = Math.round(
    afterDiscount * (serviceChargeRate / 100)
  )
  const totalPrice = afterDiscount + taxAmount + serviceChargeAmount

  return {
    subTotal,
    totalQuantity,
    discountAmount,
    taxAmount,
    serviceChargeAmount,
    totalPrice
  }
}

exports.createOrder = async (req, res) => {
  const {
    store,
    tableId,
    cashierId,
    cashierName,
    items,
    discountId,
    discountAmount,
    promoCode,
    customerId,
    customerName,
    customerPhone,
    notes,
    source,
    paymentMethod,
    currencyId,
    currencyCode,
    exchangeRate,
    redeemedPoints
  } = req.body

  try {
    const orderNumber = generateOrderNumber()

    if (tableId) {
      const table = await Table.findOne({ where: { id: tableId, store } })
      if (table) {
        if (table.status === 'occupied') {
          return res.status(400).json({
            message: 'Table is already occupied'
          })
        }
        await table.update({ status: 'occupied' })
      }
    }

    let discountValue = 0
    let discountType = 'none'
    let appliedDiscountId = null
    let appliedDiscountMeta = null

    // Priority 1: Explicit discountId (from dropdown)
    if (discountId) {
      const discount = await Discount.findOne({
        where: { id: discountId, store }
      })
      if (discount) {
        discountValue = discount.value
        discountType = discount.type
        appliedDiscountId = discount.id
        appliedDiscountMeta = discount
      }
    }

    // Priority 2: Promo code
    if (promoCode && !appliedDiscountId) {
      const promoDiscount = await Discount.findOne({
        where: { code: promoCode.trim().toUpperCase(), store, status: 'active' }
      })
      if (promoDiscount) {
        const now = new Date()
        if (
          !promoDiscount.startDate ||
          new Date(promoDiscount.startDate) <= now
        ) {
          if (
            !promoDiscount.endDate ||
            new Date(promoDiscount.endDate) >= now
          ) {
            discountValue = promoDiscount.value
            discountType = promoDiscount.type
            appliedDiscountId = promoDiscount.id
            appliedDiscountMeta = promoDiscount
          }
        }
      }
    }

    // Priority 2.5: Happy hour auto-discount
    if (!appliedDiscountId) {
      const now = new Date()
      const dayOfWeek = now.getDay()
      const timeStr = now.toTimeString().slice(0, 5)
      const allActive = await Discount.findAll({
        where: { store, status: 'active' }
      })
      const happyHourDiscount = allActive.find(
        (d) => d.conditions && d.conditions.promoType === 'happyHour'
      )
      if (happyHourDiscount) {
        const { daysOfWeek, startTime, endTime, discountPercent } =
          happyHourDiscount.conditions
        if (
          (!daysOfWeek ||
            daysOfWeek.length === 0 ||
            daysOfWeek.includes(dayOfWeek)) &&
          (!startTime || timeStr >= startTime) &&
          (!endTime || timeStr <= endTime)
        ) {
          discountValue = discountPercent || 10
          discountType = 'percent'
          appliedDiscountId = happyHourDiscount.id
          appliedDiscountMeta = happyHourDiscount
        }
      }
    }

    // Priority 3: Member tier auto-discount
    if (!appliedDiscountId && customerId) {
      try {
        const member = await db.member.findByPk(customerId)
        if (member && member.tier) {
          const tier = await db.member_tier.findByPk(member.tier)
          if (tier && tier.discountPercent > 0) {
            discountValue = tier.discountPercent
            discountType = 'percent'
          }
        }
      } catch (e) {
        console.error('Tier discount lookup error:', e.message)
      }
    }

    // Priority 4: Redeem points
    const POINT_VALUE = 1 // ponytail: 1 point = Rp 1; make configurable per tier if needed
    let redeemedPointsUsed = 0
    let pointDiscountAmount = 0
    if (redeemedPoints > 0 && customerId) {
      try {
        const member = await db.member.findByPk(customerId)
        if (member && (member.totalPoints || 0) >= redeemedPoints) {
          pointDiscountAmount = redeemedPoints * POINT_VALUE
          redeemedPointsUsed = redeemedPoints
        }
      } catch (e) {
        console.error('Point redemption error:', e.message)
      }
    }

    // ponytail: snapshot original subtotals for per-item discountAmount tracking
    items.forEach((item) => { item._origSubtotal = item.subtotal })

    const taxRate = await getActiveTaxRate(store)
    const serviceChargeRate = await getServiceChargeRate(store)

    let totals
    let promoDiscountAmount = 0

    // Check if discount has advanced promo type (bogo/bundling/category)
    if (
      appliedDiscountMeta &&
      appliedDiscountMeta.conditions &&
      appliedDiscountMeta.conditions.promoType
    ) {
      promoDiscountAmount = await applyAdvancedPromo(items, appliedDiscountMeta)
      totals = calculateOrderTotals(
        items,
        0,
        'none',
        taxRate,
        serviceChargeRate
      )
      totals.discountAmount = promoDiscountAmount
    } else {
      totals = calculateOrderTotals(
        items,
        discountValue,
        discountType,
        taxRate,
        serviceChargeRate
      )
    }

    // Apply maximumDiscount cap for percent type
    if (discountType === 'percent' && appliedDiscountId) {
      const discountMeta = await Discount.findByPk(appliedDiscountId)
      if (
        discountMeta &&
        discountMeta.maximumDiscount > 0 &&
        totals.discountAmount > discountMeta.maximumDiscount
      ) {
        totals.discountAmount = discountMeta.maximumDiscount
        const afterDiscount = totals.subTotal - totals.discountAmount
        totals.taxAmount = Math.round(afterDiscount * (taxRate / 100))
        totals.serviceChargeAmount = Math.round(
          afterDiscount * (serviceChargeRate / 100)
        )
        totals.totalPrice =
          afterDiscount + totals.taxAmount + totals.serviceChargeAmount
      }
    }

    // Apply point redemption discount on top
    if (pointDiscountAmount > 0) {
      totals.discountAmount += pointDiscountAmount
      const afterDiscount = totals.subTotal - totals.discountAmount
      totals.taxAmount = Math.round(afterDiscount * (taxRate / 100))
      totals.serviceChargeAmount = Math.round(afterDiscount * (serviceChargeRate / 100))
      totals.totalPrice = Math.max(0, afterDiscount + totals.taxAmount + totals.serviceChargeAmount)
    }

    // Stock validation
    for (const item of items) {
      const prod = await Product.findByPk(item.product || item.productId)
      if (!prod) {
        return res.status(400).json({
          message: `Product not found: ${item.productName || item.product || item.productId}`
        })
      }
      if (prod.stock !== null && Number(prod.stock) < Number(item.quantity)) {
        return res.status(400).json({
          message: `Stok "${prod.nameProduct}" tidak mencukupi. Tersedia: ${prod.stock}, diminta: ${item.quantity}`
        })
      }
    }

    const order = await Order.create({
      orderNumber,
      store,
      tableId,
      cashierId,
      cashierName,
      customerId,
      customerName,
      customerPhone,
      notes,
      paymentMethod,
      source: source || 'pos',
      status: 'paid',
      paymentStatus: 'paid',
      subTotal: totals.subTotal,
      totalQuantity: totals.totalQuantity,
      discountType,
      discountValue,
      discountAmount: totals.discountAmount,
      discountId: appliedDiscountId,
      promoCode: promoCode || null,
      taxRate,
      taxAmount: totals.taxAmount,
      serviceChargeRate,
      serviceChargeAmount: totals.serviceChargeAmount,
      totalPrice: totals.totalPrice,
      currencyId: currencyId || null,
      currencyCode: currencyCode || null,
      exchangeRate: exchangeRate || null,
      createdBy: req.user?.id
    })

    for (const item of items) {
      const product = await Product.findByPk(item.product || item.productId)
      const costPrice = product
        ? Number(product.costPrice || product.price || 0)
        : 0
      const itemDiscountAmount = Math.max(0, (item._origSubtotal || 0) - (item.subtotal || 0))
      await OrderItem.create({
        order: order.id,
        product: item.product || item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.basePrice || item.price,
        discountType,
        discountValue,
        discountAmount: itemDiscountAmount,
        totalPrice: item.subtotal || item.totalPrice,
        options: item.options || [],
        modifiers: item.modifiers || [],
        notes: item.notes,
        hppSnapshot: costPrice,
        status: 'pending'
      })
    }

    // Reduce stock & create stock history
    for (const item of items) {
      const product = await Product.findByPk(item.product || item.productId)
      if (product) {
        const oldStock = Number(product.stock) || 0
        const newStock = oldStock - Number(item.quantity)
        await product.update({ stock: newStock >= 0 ? newStock : 0 })

        // ponytail: per-store stock sync, needed for stock transfers/opname
        const [pss] = await db.product_store_stock.findOrCreate({
          where: { product: product.id, store },
          defaults: { stock: 0 }
        })
        const oldPssStock = Number(pss.stock) || 0
        const newPssStock = oldPssStock - Number(item.quantity)
        await pss.update({ stock: newPssStock >= 0 ? newPssStock : 0 })

        await db.stock_history.create({
          product: product.id,
          store,
          referenceType: 'sale',
          referenceId: order.id,
          quantityBefore: oldStock,
          quantityChange: -Number(item.quantity),
          quantityAfter: newStock >= 0 ? newStock : 0,
          unit: product.unit || 'pcs',
          notes: `Penjualan: ${orderNumber}`,
          createdBy: req.user?.id
        })

        // Update best_selling
        const findBs = await db.best_selling.findOne({
          where: { productId: product.id, nameProduct: item.productName, store }
        })
        if (findBs) {
          await db.best_selling.update(
            {
              totalSelling: Number(findBs.totalSelling) + Number(item.quantity)
            },
            { where: { productId: product.id, nameProduct: item.productName } }
          )
        } else {
          await db.best_selling.create({
            productId: product.id,
            nameProduct: item.productName,
            image: product.image || null,
            totalSelling: Number(item.quantity),
            store
          })
        }
      }
    }

    // Create transaction record
    if (paymentMethod) {
      await db.transaction.create({
        order: order.id,
        typePayment: paymentMethod,
        amount: totals.totalPrice,
        createdBy: req.user?.id
      })
    }

    await OrderStatus.create({
      order: order.id,
      status: 'paid',
      createdBy: req.user?.id,
      notes: `Paid by ${cashierName} via ${paymentMethod || 'cash'}`
    })

    // Deduct redeemed points from member
    if (redeemedPointsUsed > 0 && customerId) {
      try {
        const member = await db.member.findByPk(customerId)
        if (member) {
          const oldPoints = Number(member.totalPoints) || 0
          const newPoints = oldPoints - redeemedPointsUsed
          await member.update({ totalPoints: Math.max(0, newPoints) })
          await db.member_point_history.create({
            member: customerId,
            pointsChange: -redeemedPointsUsed,
            pointsBefore: oldPoints,
            pointsAfter: Math.max(0, newPoints),
            transactionId: order.id,
            notes: `Redeemed ${redeemedPointsUsed} points for order ${orderNumber}`
          })
        }
      } catch (e) {
        console.error('Point deduction error:', e.message)
      }
    }

    // Award points earned from product point values
    if (customerId) {
      try {
        const productIds = [...new Set(items.map(i => i.product || i.productId))]
        const products = await Product.findAll({ where: { id: productIds }, attributes: ['id', 'point'] })
        const pointMap = Object.fromEntries(products.map(p => [p.id, Number(p.point) || 0]))
        const pointsEarned = items.reduce((sum, item) => {
          const pid = item.product || item.productId
          return sum + (pointMap[pid] || 0) * Number(item.quantity)
        }, 0)

        if (pointsEarned > 0) {
          const member = await db.member.findByPk(customerId)
          if (member) {
            const oldTotal = Number(member.totalPoints) || 0
            const oldLifetime = Number(member.lifetimePoints) || 0
            const newTotal = oldTotal + pointsEarned
            await member.update({
              totalPoints: newTotal,
              lifetimePoints: oldLifetime + pointsEarned
            })

            // ponytail: prefer exact min≤total≤max match; fall back to highest minPoints (gap scenario)
            const Op = require('sequelize').Op
            let targetTier = await db.member_tier.findOne({
              where: { status: 'active', minPoints: { [Op.lte]: newTotal }, maxPoints: { [Op.gte]: newTotal } },
              order: [['minPoints', 'DESC']]
            })
            if (!targetTier) {
              targetTier = await db.member_tier.findOne({
                where: { status: 'active', minPoints: { [Op.lte]: newTotal } },
                order: [['minPoints', 'DESC']]
              })
            }
            if (targetTier) {
              const currentTierRow = member.tier
                ? await db.member_tier.findByPk(member.tier)
                : null
              const currentMin = Number(currentTierRow?.minPoints || -1)
              if (Number(targetTier.minPoints) > currentMin) {
                await member.update({ tier: targetTier.id })
              }
            }

            await db.member_point_history.create({
              member: customerId,
              pointsChange: pointsEarned,
              pointsBefore: oldTotal,
              pointsAfter: oldTotal + pointsEarned,
              transactionId: order.id,
              notes: `Earned ${pointsEarned} points from order ${orderNumber}`,
              createdBy: req.user?.id
            })
          }
        }
      } catch (e) {
        console.error('Point earning error:', e.message)
      }
    }

    const fullOrder = await Order.findOne({
      where: { id: order.id },
      include: [
        { model: OrderItem, as: 'items' },
        { model: db.transaction, as: 'transactions' }
      ]
    })

    createNotification({
      type: 'payment_received',
      store,
      referenceId: order.id,
      referenceType: 'order',
      params: [orderNumber, totals.totalPrice],
      createdBy: req.user?.fullName || 'System'
    }).catch(console.error)
    createAudit(
      req,
      'create',
      'order',
      order.id,
      `Created order: ${orderNumber}`
    )

    emitNewOrder(store, fullOrder)

    return res.status(201).json({
      message: 'Order created successfully',
      data: fullOrder
    })
  } catch (error) {
    console.error('Error creating order:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.getOrdersByStore = async (req, res) => {
  const { store, status, date, table, startDate, endDate, page, limit } =
    req.query

  try {
    const where = {}
    if (store) where.store = store
    if (status) where.status = status
    if (req.query.paymentStatus) where.paymentStatus = req.query.paymentStatus
    if (date) {
      where.createdAt = {
        [require('sequelize').Op.gte]: new Date(date + ' 00:00:00'),
        [require('sequelize').Op.lte]: new Date(date + ' 23:59:59')
      }
    }
    if (startDate && endDate) {
      where.createdAt = {
        [require('sequelize').Op.gte]: new Date(startDate + ' 00:00:00'),
        [require('sequelize').Op.lte]: new Date(endDate + ' 23:59:59')
      }
    }
    if (table) {
      where.tableId = table
    }

    const pageNum = parseInt(page) || 1
    const limitNum = parseInt(limit) || 50
    const offset = (pageNum - 1) * limitNum

    const { count: total, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: OrderItem,
          as: 'items'
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset
    })

    return res.status(200).json({
      message: 'Success',
      data: orders,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.getOrderById = async (req, res) => {
  const { id } = req.params

  try {
    const order = await Order.findOne({
      where: { id },
      include: [
        { model: OrderItem, as: 'items' },
        { model: OrderStatus, as: 'statusHistory' },
        { model: Table, as: 'table' }
      ]
    })

    if (!order) {
      return res.status(404).json({
        message: 'Order not found'
      })
    }

    return res.status(200).json({
      message: 'Success',
      data: order
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.updateOrderStatus = async (req, res) => {
  const { id, store, status, changedBy, changedByName, notes } = req.body

  try {
    const order = await Order.findOne({ where: { id, store } })

    if (!order) {
      return res.status(404).json({
        message: 'Order not found'
      })
    }

    const oldStatus = order.status

    await order.update({ status })

    await OrderStatus.create({
      order: id,
      status,
      createdBy: changedBy,
      notes: notes || (changedByName ? `By ${changedByName}` : null)
    })

    // If transitioning from pending/unpaid to paid, reduce stock
    if (status === 'paid' && oldStatus !== 'paid') {
      const items = await OrderItem.findAll({ where: { order: id } })

      for (const item of items) {
        const product = await Product.findByPk(item.product)
        if (product) {
          const oldStock = Number(product.stock) || 0
          const newStock = Math.max(0, oldStock - Number(item.quantity))
          await product.update({ stock: newStock })

          await db.stock_history.create({
            product: product.id,
            store,
            referenceType: 'sale',
            referenceId: order.id,
            quantityBefore: oldStock,
            quantityChange: -Number(item.quantity),
            quantityAfter: newStock,
            unit: product.unit || 'pcs',
            notes: `Penjualan: ${order.orderNumber}`,
            createdBy: changedBy
          })

          const findBs = await db.best_selling.findOne({
            where: {
              productId: product.id,
              nameProduct: item.productName,
              store
            }
          })
          if (findBs) {
            await db.best_selling.update(
              {
                totalSelling:
                  Number(findBs.totalSelling) + Number(item.quantity)
              },
              {
                where: { productId: product.id, nameProduct: item.productName }
              }
            )
          } else {
            await db.best_selling.create({
              productId: product.id,
              nameProduct: item.productName,
              image: product.image || null,
              totalSelling: Number(item.quantity),
              store
            })
          }
        }
      }
    }

    if (order.tableId && ['paid', 'cancelled', 'void'].includes(status)) {
      await Table.update(
        { status: 'available' },
        { where: { id: order.tableId } }
      )
    }

    createAudit(req, 'update', 'order', id, `Updated order status to ${status}`)

    return res.status(200).json({
      message: 'Order status updated',
      data: order
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.updateOrderItemStatus = async (req, res) => {
  const { id, itemId, itemStatus } = req.body

  try {
    const item = await OrderItem.findOne({ where: { id: itemId, order: id } })

    if (!item) {
      return res.status(404).json({
        message: 'Item not found'
      })
    }

    await item.update({ status: itemStatus })

    const order = await Order.findByPk(id)
    if (order) {
      emitItemStatusUpdate(order.store, id, item)
    }

    const allItems = await OrderItem.findAll({ where: { order: id } })
    const allSameStatus = allItems.every((i) => i.status === itemStatus)

    if (allSameStatus) {
      const statusMap = {
        pending: 'pending',
        preparing: 'preparing',
        ready: 'ready',
        served: 'served'
      }
      await Order.update({ status: statusMap[itemStatus] }, { where: { id } })
    }

    return res.status(200).json({
      message: 'Item status updated',
      data: item
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.getKitchenOrders = async (req, res) => {
  const { store } = req.query

  try {
    // ponytail: order-level status is 'paid' at POS — kitchen cares about item status only
    const orders = await Order.findAll({
      where: { store },
      include: [
        {
          model: OrderItem,
          as: 'items',
          where: {
            status: {
              [require('sequelize').Op.in]: ['pending', 'preparing', 'ready']
            }
          }
        }
      ],
      order: [['createdAt', 'DESC']]
    })

    return res.status(200).json({
      message: 'Success',
      data: orders
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.getCustomerMenu = async (req, res) => {
  const { store } = req.query

  try {
    if (!store) {
      return res.status(400).json({ message: 'store is required' })
    }

    const Op = require('sequelize').Op
    const storeId = Number(store)

    const products = await db.product.findAll({
      where: {
        [Op.or]: [
          { store: { [Op.contains]: [storeId] } },
          { store: null },
          db.sequelize.literal("\"product\".\"store\" = '[]'::jsonb")
        ],
        status: 'active'
      },
      include: [
        { model: db.category, as: 'categoryData', attributes: ['name'] }
      ],
      order: [
        ['categoryData', 'name', 'ASC'],
        ['nameProduct', 'ASC']
      ]
    })

    const categories = await db.category.findAll({
      where: {
        [Op.or]: [
          { store: { [Op.contains]: [storeId] } },
          { store: null },
          db.sequelize.literal("\"category\".\"store\" = '[]'::jsonb")
        ],
        status: 'active'
      },
      order: [['name', 'ASC']]
    })

    return res.status(200).json({
      message: 'Success',
      data: { products, categories }
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

exports.createCustomerOrder = async (req, res) => {
  const { store, tableId, items, customerName, notes } = req.body

  try {
    if (!store || !items || !items.length) {
      return res.status(400).json({ message: 'store and items are required' })
    }

    const orderNumber =
      'CUST-' +
      Date.now().toString().slice(-8) +
      Math.random().toString(36).slice(2, 6).toUpperCase()

    const table = tableId
      ? await db.table.findOne({ where: { id: tableId, store } })
      : null
    if (tableId && !table) {
      return res.status(400).json({ message: 'Table not found' })
    }

    let subTotal = 0
    let totalQuantity = 0
    const orderItems = []
    for (const item of items) {
      const subtotal = item.price * item.quantity
      subTotal += subtotal
      totalQuantity += item.quantity
      const prod = item.productId
        ? await db.product.findByPk(item.productId)
        : null
      const costPrice = prod ? Number(prod.costPrice || prod.price || 0) : 0
      orderItems.push({
        product: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        totalPrice: subtotal,
        hppSnapshot: costPrice,
        notes: item.notes || null,
        status: 'pending'
      })
    }

    const order = await db.order.create({
      orderNumber,
      store,
      tableId: tableId || null,
      cashierId: null,
      cashierName: customerName || 'Customer',
      customerName: customerName || null,
      notes,
      source: 'qr',
      status: 'pending',
      subTotal,
      totalQuantity,
      discountType: 'none',
      discountValue: 0,
      taxAmount: 0,
      serviceChargeAmount: 0,
      totalPrice: subTotal
    })

    for (const item of orderItems) {
      await db.order_item.create({ ...item, order: order.id })
    }

    if (table) {
      await table.update({ status: 'occupied' })
    }

    return res.status(201).json({
      message: 'Order created',
      data: order
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

exports.getReceiptHTML = async (req, res) => {
  const { id } = req.params

  try {
    const order = await db.order.findByPk(id, {
      include: [
        { model: db.order_item, as: 'items' },
        { model: db.table, as: 'table' }
      ]
    })

    if (!order) {
      return res.status(404).send('<h1>Order not found</h1>')
    }

    const storeData = order.store
      ? await db.location.findByPk(order.store, {
          attributes: ['name', 'address', 'phoneNumber']
        })
      : null

    const setting = order.store
      ? await db.invoice_setting.findOne({ where: { store: order.store } })
      : null

    const showLogo = setting?.showLogo !== false
    const showStoreName = setting?.showStoreName !== false
    const showAddress = setting?.showAddress !== false
    const logoUrl = setting?.logo || null

    const formatPrice = (v) => 'Rp' + Number(v || 0).toLocaleString('id-ID')

    const date = new Date(order.createdAt).toLocaleString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    const itemsHtml = (order.items || [])
      .map(
        (item, i) => `
      <tr>
        <td style="padding:6px 4px;border-bottom:1px dashed #ccc">${i + 1}. ${item.productName || '-'}</td>
        <td style="text-align:center;padding:6px 4px;border-bottom:1px dashed #ccc">${item.quantity}</td>
        <td style="text-align:right;padding:6px 4px;border-bottom:1px dashed #ccc">${formatPrice(item.price)}</td>
        <td style="text-align:right;padding:6px 4px;border-bottom:1px dashed #ccc">${formatPrice(item.totalPrice)}</td>
      </tr>`
      )
      .join('')

    const STATUS_LABELS = {
      paid: 'LUNAS',
      unpaid: 'BELUM DIBAYAR',
      partial: 'DP'
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice - ${order.orderNumber}</title>
  <style>
    body { font-family: 'Courier New', monospace; font-size: 13px; margin: 0; padding: 20px; color: #000; }
    .receipt { max-width: 380px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 12px; }
    .header h2 { margin: 4px 0; text-transform: uppercase; font-size: 16px; }
    .header p { margin: 2px 0; font-size: 11px; color: #555; }
    .info { border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; font-size: 11px; }
    .info div { display: flex; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #000; padding: 4px; }
    th.right { text-align: right; }
    th.center { text-align: center; }
    .totals { border-top: 1px dashed #000; padding-top: 8px; margin-top: 4px; font-size: 12px; }
    .totals > div { display: flex; justify-content: space-between; padding: 2px 0; }
    .totals .grand-total { font-weight: bold; font-size: 15px; border-top: 1px solid #000; padding-top: 6px; margin-top: 6px; }
    .footer { text-align: center; margin-top: 16px; font-size: 11px; color: #888; border-top: 1px dashed #ccc; padding-top: 12px; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: bold; }
    .status-paid { background: #d4edda; color: #155724; }
    .status-unpaid { background: #fff3cd; color: #856404; }
    @media print { body { padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      ${showLogo && logoUrl ? `<img src="${logoUrl}" style="max-height:50px;margin-bottom:6px" />` : ''}
      ${showStoreName ? `<h2>${storeData?.name || 'TOKO'}</h2>` : ''}
      ${showAddress && storeData ? `<p>${[storeData.address, storeData.phoneNumber].filter(Boolean).join(' | ')}</p>` : ''}
    </div>

    <div class="info">
      <div><span>Invoice</span><strong>${order.orderNumber}</strong></div>
      <div><span>Tanggal</span><span>${date}</span></div>
      <div><span>Kasir</span><span>${order.cashierName || '-'}</span></div>
      ${order.customerName ? `<div><span>Pelanggan</span><span>${order.customerName}</span></div>` : ''}
      ${order.table?.name ? `<div><span>Meja</span><span>${order.table.name}</span></div>` : ''}
      <div style="margin-top:4px">
        <span class="status-badge ${order.paymentStatus === 'paid' ? 'status-paid' : 'status-unpaid'}">
          ${STATUS_LABELS[order.paymentStatus] || order.paymentStatus || 'BELUM DIBAYAR'}
        </span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item</th><th class="center">Qty</th><th class="right">Harga</th><th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="totals">
      <div><span>Subtotal</span><span>${formatPrice(order.subTotal)}</span></div>
      ${order.discountAmount > 0 ? `<div><span>Diskon</span><span style="color:#c00">-${formatPrice(order.discountAmount)}</span></div>` : ''}
      ${order.serviceChargeAmount > 0 ? `<div><span>Biaya Layanan</span><span>${formatPrice(order.serviceChargeAmount)}</span></div>` : ''}
      ${order.taxAmount > 0 ? `<div><span>Pajak</span><span>${formatPrice(order.taxAmount)}</span></div>` : ''}
      <div class="grand-total"><span>TOTAL</span><span>${formatPrice(order.totalPrice)}</span></div>
      <div><span>${order.paymentMethod || '-'}</span><span>${formatPrice(order.totalPrice)}</span></div>
    </div>

    <div class="footer">
      Terima kasih atas kunjungan Anda
    </div>

    <div class="no-print" style="text-align:center;margin-top:20px">
      <button onclick="window.print()" style="padding:8px 24px;font-size:14px;cursor:pointer;border:1px solid #ccc;border-radius:6px;background:#fff">
        Cetak / Simpan PDF
      </button>
      <p style="font-size:11px;color:#999;margin-top:6px">Tekan tombol di atas, lalu pilih "Save as PDF"</p>
    </div>
  </div>
</body>
</html>`

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(html)
  } catch (error) {
    console.error('Error generating receipt:', error)
    return res.status(500).send('<h1>Internal Server Error</h1>')
  }
}
