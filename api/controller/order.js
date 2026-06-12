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
const { emitItemStatusUpdate } = require('../service/socket')

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

const applyAdvancedPromo = (items, discount) => {
  if (!discount || !discount.conditions || !discount.conditions.promoType)
    return 0
  const { promoType } = discount.conditions
  let totalDiscount = 0

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
      items.forEach((item) => {
        if (catSet.has(Number(item.categoryId))) {
          const disc = Math.round(item.subtotal * (discountPercent / 100))
          item.subtotal -= disc
          totalDiscount += disc
        }
      })
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
    promoCode,
    customerId,
    customerName,
    customerPhone,
    notes,
    source,
    currencyId,
    currencyCode,
    exchangeRate
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
      promoDiscountAmount = applyAdvancedPromo(items, appliedDiscountMeta)
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
      source: source || 'pos',
      status: 'pending',
      subTotal: totals.subTotal,
      totalQuantity: totals.totalQuantity,
      discountType,
      discountValue,
      discountAmount: totals.discountAmount,
      taxRate,
      taxAmount: totals.taxAmount,
      serviceChargeRate,
      serviceChargeAmount: totals.serviceChargeAmount,
      totalPrice: totals.totalPrice,
      currencyId: currencyId || null,
      currencyCode: currencyCode || null,
      exchangeRate: exchangeRate || null,
      createdBy: cashierId
    })

    for (const item of items) {
      await OrderItem.create({
        order: order.id,
        product: item.product || item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.basePrice || item.price,
        options: item.options || [],
        modifiers: item.modifiers || [],
        notes: item.notes,
        totalPrice: item.subtotal || item.totalPrice,
        status: 'pending'
      })
    }

    await OrderStatus.create({
      order: order.id,
      status: 'pending',
      createdBy: cashierId,
      notes: `Created by ${cashierName}`
    })

    const fullOrder = await Order.findOne({
      where: { id: order.id },
      include: [
        {
          model: OrderItem,
          as: 'items'
        }
      ]
    })

    createNotification({
      type: 'order_created',
      store,
      referenceId: order.id,
      referenceType: 'order',
      params: [orderNumber]
    }).catch(console.error)
    createAudit(
      req,
      'create',
      'order',
      order.id,
      `Created order: ${orderNumber}`
    )

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
  const { store, status, date } = req.query

  try {
    const where = { store }
    if (status) {
      where.status = status
    }
    if (date) {
      where.createdAt = {
        [require('sequelize').Op.gte]: new Date(date + ' 00:00:00'),
        [require('sequelize').Op.lte]: new Date(date + ' 23:59:59')
      }
    }

    const orders = await Order.findAll({
      where,
      include: [
        {
          model: OrderItem,
          as: 'items'
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

    await order.update({ status })

    await OrderStatus.create({
      order: id,
      status,
      createdBy: changedBy,
      notes: notes || (changedByName ? `By ${changedByName}` : null)
    })

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
  const { store, status } = req.query

  try {
    const where = {
      store,
      status: {
        [require('sequelize').Op.in]: [
          'pending',
          'confirmed',
          'preparing',
          'ready'
        ]
      }
    }

    if (status) {
      where.status = status
    }

    const orders = await Order.findAll({
      where,
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
      order: [['createdAt', 'ASC']]
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

    const products = await db.product.findAll({
      where: { store, status: 'active' },
      include: [
        { model: db.category, as: 'categoryData', attributes: ['name'] }
      ],
      order: [
        ['categoryData', 'name', 'ASC'],
        ['name', 'ASC']
      ]
    })

    const categories = await db.category.findAll({
      where: { store, status: 'active' },
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
    const orderItems = items.map((item) => {
      const subtotal = item.price * item.quantity
      subTotal += subtotal
      totalQuantity += item.quantity
      return {
        product: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        totalPrice: subtotal,
        notes: item.notes || null,
        status: 'pending'
      }
    })

    const order = await db.order.create({
      orderNumber,
      store,
      tableId: tableId || null,
      cashierName: customerName || 'Customer',
      customerName: customerName || null,
      notes,
      source: 'customer',
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
