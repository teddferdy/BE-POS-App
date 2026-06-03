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

const generateOrderNumber = () => {
  const date = new Date()
  const timestamp = date.getTime().toString().slice(-8)
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ORD${timestamp}${random}`
}

const calculateOrderTotals = (items, discountValue = 0, discountType = 'none', taxRate = 0, serviceChargeRate = 0) => {
  let subTotal = 0
  let totalQuantity = 0

  items.forEach(item => {
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
  const serviceChargeAmount = Math.round(afterDiscount * (serviceChargeRate / 100))
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
  const { store, tableId, cashierId, cashierName, items, discountId, customerId, customerName, customerPhone, notes, source, currencyId, currencyCode, exchangeRate } = req.body

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
    if (discountId) {
      const discount = await Discount.findOne({ where: { id: discountId, store } })
      if (discount) {
        discountValue = discount.value
        discountType = discount.type
      }
    }

    const taxRate = 10
    const serviceChargeRate = 5

    const totals = calculateOrderTotals(items, discountValue, discountType, taxRate, serviceChargeRate)

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
      include: [{
        model: OrderItem,
        as: 'items'
      }]
    })

    createNotification({ type: 'order_created', store, referenceId: order.id, referenceType: 'order', params: [orderNumber] }).catch(console.error)
    createAudit(req, 'create', 'order', order.id, `Created order: ${orderNumber}`)

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
      include: [{
        model: OrderItem,
        as: 'items'
      }],
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
      await Table.update({ status: 'available' }, { where: { id: order.tableId } })
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

    const allItems = await OrderItem.findAll({ where: { order: id } })
    const allSameStatus = allItems.every(i => i.status === itemStatus)

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

exports.addItemToOrder = async (req, res) => {
  const { id, store, item, updatedBy } = req.body

  try {
    const order = await Order.findOne({ where: { id, store } })

    if (!order) {
      return res.status(404).json({
        message: 'Order not found'
      })
    }

    if (['paid', 'cancelled', 'void'].includes(order.status)) {
      return res.status(400).json({
        message: 'Cannot add items to completed order'
      })
    }

    const newItem = await OrderItem.create({
      order: id,
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

    const allItems = await OrderItem.findAll({ where: { order: id } })
    let subTotal = 0
    let totalQuantity = 0
    allItems.forEach(i => {
      subTotal += Number(i.totalPrice) || 0
      totalQuantity += i.quantity
    })

    await order.update({
      subTotal,
      totalQuantity
    })

    return res.status(201).json({
      message: 'Item added to order',
      data: newItem
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.removeItemFromOrder = async (req, res) => {
  const { id, itemId, store } = req.body

  try {
    const order = await Order.findOne({ where: { id, store } })

    if (!order) {
      return res.status(404).json({
        message: 'Order not found'
      })
    }

    if (['paid', 'cancelled', 'void'].includes(order.status)) {
      return res.status(400).json({
        message: 'Cannot remove items from completed order'
      })
    }

    const item = await OrderItem.findOne({ where: { id: itemId, order: id } })

    if (!item) {
      return res.status(404).json({
        message: 'Item not found'
      })
    }

    await item.destroy()

    const allItems = await OrderItem.findAll({ where: { order: id } })
    let subTotal = 0
    let totalQuantity = 0
    allItems.forEach(i => {
      subTotal += Number(i.totalPrice) || 0
      totalQuantity += i.quantity
    })

    await order.update({
      subTotal,
      totalQuantity
    })

    return res.status(200).json({
      message: 'Item removed from order'
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.applyDiscount = async (req, res) => {
  const { id, store, discountId } = req.body

  try {
    const order = await Order.findOne({ where: { id, store } })

    if (!order) {
      return res.status(404).json({
        message: 'Order not found'
      })
    }

    const discount = await Discount.findOne({ where: { id: discountId, store } })

    if (!discount) {
      return res.status(404).json({
        message: 'Discount not found'
      })
    }

    const totals = calculateOrderTotals(
      await OrderItem.findAll({ where: { order: id } }),
      discount.value,
      discount.type,
      order.taxRate,
      order.serviceChargeRate
    )

    await order.update({
      discountType: discount.type,
      discountValue: discount.value,
      discountAmount: totals.discountAmount,
      totalPrice: totals.totalPrice
    })

    createAudit(req, 'update', 'order', id, `Applied discount to order: ${id}`)

    return res.status(200).json({
      message: 'Discount applied',
      data: order
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.payment = async (req, res) => {
  const { id, store, paymentMethod, paymentStatus } = req.body

  try {
    const order = await Order.findOne({
      where: { id, store },
      include: [{ model: OrderItem, as: 'items' }]
    })

    if (!order) {
      return res.status(404).json({
        message: 'Order not found'
      })
    }

    await order.update({
      paymentMethod,
      paymentStatus: paymentStatus || 'paid',
      status: 'paid'
    })

    await OrderStatus.create({
      order: id,
      status: 'paid',
      notes: `Payment via ${paymentMethod}`,
      createdBy: order.cashierId
    })

    for (const item of order.items) {
      await Transaction.create({
        order: order.id,
        typePayment: paymentMethod,
        amount: item.totalPrice || 0,
        createdBy: order.cashierId
      })

      const bestSelling = await BestSelling.findOne({
        where: { productId: item.product, store }
      })

      if (bestSelling) {
        await bestSelling.update({
          totalSelling: (bestSelling.totalSelling || 0) + item.quantity
        })
      } else {
        await BestSelling.create({
          productId: item.product,
          nameProduct: item.productName,
          image: item.productImage || null,
          totalSelling: item.quantity,
          store
        })
      }
    }

    if (order.tableId) {
      await Table.update({ status: 'available' }, { where: { id: order.tableId } })
    }

    createNotification({ type: 'payment_received', store, referenceId: order.id, referenceType: 'order', params: [order.orderNumber, order.totalPrice] }).catch(console.error)

    return res.status(200).json({
      message: 'Payment successful',
      data: order
    })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

exports.voidOrder = async (req, res) => {
  const { id, store, reason, voidedBy, voidedByName } = req.body

  try {
    const order = await Order.findOne({ where: { id, store } })

    if (!order) {
      return res.status(404).json({
        message: 'Order not found'
      })
    }

    if (order.status === 'void') {
      return res.status(400).json({
        message: 'Order is already voided'
      })
    }

    await order.update({ status: 'void' })

    await OrderStatus.create({
      order: id,
      status: 'void',
      createdBy: voidedBy,
      notes: reason || (voidedByName ? `By ${voidedByName}` : null)
    })

    if (order.tableId) {
      await Table.update({ status: 'available' }, { where: { id: order.tableId } })
    }

    createAudit(req, 'update', 'order', id, `Voided order: ${order.orderNumber}`)

    return res.status(200).json({
      message: 'Order voided successfully',
      data: order
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
    const where = { store, status: { [require('sequelize').Op.in]: ['pending', 'confirmed', 'preparing', 'ready'] } }

    if (status) {
      where.status = status
    }

    const orders = await Order.findAll({
      where,
      include: [{
        model: OrderItem,
        as: 'items',
        where: { status: { [require('sequelize').Op.in]: ['pending', 'preparing', 'ready'] } }
      }],
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