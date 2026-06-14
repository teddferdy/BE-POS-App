'use strict'
const { Op } = require('sequelize')
const db = require('../../db/models')
const Order = db.order
const OrderItem = db.order_item
const Transaction = db.transaction
const Expense = db.expense

exports.getDailyReport = async (req, res) => {
  try {
    const { store, startDate, endDate } = req.query
    const orderWhere = { paymentStatus: 'paid' }
    if (store) orderWhere.store = store
    if (startDate || endDate) {
      orderWhere.createdAt = {}
      if (startDate) orderWhere.createdAt[Op.gte] = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        orderWhere.createdAt[Op.lte] = end
      }
    }

    const orders = await Order.findAll({
      where: orderWhere,
      include: [
        { model: OrderItem, as: 'items' },
        { model: Transaction, as: 'transactions' }
      ],
      order: [['createdAt', 'DESC']]
    })

    const totalRevenue = orders.reduce((s, o) => s + Number(o.totalPrice || 0), 0)
    const totalDiscount = orders.reduce((s, o) => s + Number(o.discountAmount || 0), 0)
    const netRevenue = totalRevenue - totalDiscount
    const totalOrders = orders.length
    const totalQty = orders.reduce((s, o) => s + Number(o.totalQuantity || 0), 0)

    let totalHpp = 0
    const orderIds = orders.map((o) => o.id)
    if (orderIds.length > 0) {
      const items = await OrderItem.findAll({ where: { order: orderIds } })
      totalHpp = items.reduce((s, i) => s + Number(i.hppSnapshot || i.price || 0), 0)
    }

    const grossProfit = netRevenue - totalHpp

    const expenses = store
      ? await Expense.sum('amount', {
          where: {
            store,
            status: 'approved',
            date: orderWhere.createdAt
          }
        })
      : 0

    const netProfit = grossProfit - (expenses || 0)

    // Group by date with HPP from order items
    const dateMap = {}
    for (const o of orders) {
      const d = new Date(o.createdAt).toISOString().slice(0, 10)
      if (!dateMap[d]) {
        dateMap[d] = {
          tanggal: d,
          totalTransaksi: 0,
          totalPenjualanBersih: 0,
          totalHpp: 0,
          foodCostPersen: 0,
          grossProfit: 0,
          netProfit: 0,
          totalCovers: 0,
          orderIds: []
        }
      }
      dateMap[d].totalTransaksi++
      dateMap[d].totalPenjualanBersih += Number(o.totalPrice || 0)
      dateMap[d].totalCovers += Number(o.totalCovers || o.totalQuantity || 1)
      dateMap[d].orderIds.push(o.id)
    }

    // Compute per-day HPP from order items
    const allOrderItems = orderIds.length > 0
      ? await OrderItem.findAll({ where: { order: orderIds } })
      : []
    for (const item of allOrderItems) {
      const orderObj = orders.find((o) => o.id === item.order)
      if (orderObj) {
        const d = new Date(orderObj.createdAt).toISOString().slice(0, 10)
        if (dateMap[d]) {
          dateMap[d].totalHpp += Number(item.hppSnapshot || item.price || 0)
        }
      }
    }

    // Compute derived fields per day
    for (const d of Object.keys(dateMap)) {
      const day = dateMap[d]
      day.grossProfit = day.totalPenjualanBersih - day.totalHpp
      day.netProfit = day.grossProfit
      day.foodCostPersen = day.totalPenjualanBersih > 0
        ? Math.round((day.totalHpp / day.totalPenjualanBersih) * 10000) / 100
        : 0
      delete day.orderIds
    }

    const reportData = Object.values(dateMap).sort((a, b) => b.tanggal.localeCompare(a.tanggal))

    res.json({
      success: true,
      data: reportData
    })
  } catch (err) {
    console.error('Daily report error:', err)
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.getProfitLoss = async (req, res) => {
  try {
    const { store, startDate, endDate } = req.query
    const orderWhere = { paymentStatus: 'paid' }
    if (store) orderWhere.store = store
    if (startDate || endDate) {
      orderWhere.createdAt = {}
      if (startDate) orderWhere.createdAt[Op.gte] = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        orderWhere.createdAt[Op.lte] = end
      }
    }
    const orders = await Order.findAll({ where: orderWhere })
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalPrice || 0), 0)
    const totalDiscount = orders.reduce((sum, o) => sum + Number(o.discountAmount || 0), 0)
    const netRevenue = totalRevenue - totalDiscount
    const orderIds = orders.map((o) => o.id)
    const items = orderIds.length > 0
      ? await OrderItem.findAll({ where: { order: orderIds } })
      : []
    const totalHpp = items.reduce((sum, i) => sum + Number(i.hppSnapshot || i.price || 0), 0)
    const grossProfit = netRevenue - totalHpp
    const marginPersen = netRevenue > 0
      ? Math.round((grossProfit / netRevenue) * 10000) / 100
      : 0

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalDiscount,
        netRevenue,
        totalHpp,
        grossProfit,
        marginPersen
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.getCashFlow = async (req, res) => {
  try {
    const { store, startDate, endDate } = req.query
    const txWhere = {}
    if (store) txWhere.store = store
    if (startDate || endDate) {
      txWhere.createdAt = {}
      if (startDate) txWhere.createdAt[Op.gte] = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        txWhere.createdAt[Op.lte] = end
      }
    }

    const payments = await Transaction.findAll({ where: txWhere })
    let penerimaanTunai = 0
    let penerimaanQris = 0
    let penerimaanTransfer = 0
    let lainnya = 0
    payments.forEach((p) => {
      const type = (p.typePayment || '').toLowerCase()
      if (type.includes('cash') || type === 'tunai')
        penerimaanTunai += Number(p.amount || 0)
      else if (type.includes('qris')) penerimaanQris += Number(p.amount || 0)
      else if (type.includes('transfer')) penerimaanTransfer += Number(p.amount || 0)
      else lainnya += Number(p.amount || 0)
    })

    const expWhere = { status: 'approved' }
    if (store) expWhere.store = store
    if (startDate || endDate) {
      expWhere.date = {}
      if (startDate) expWhere.date[Op.gte] = startDate
      if (endDate) expWhere.date[Op.lte] = endDate
    }
    const expenses = await Expense.findAll({ where: expWhere })
    const totalPengeluaran = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
    const totalKasMasuk = penerimaanTunai + penerimaanQris + penerimaanTransfer + lainnya

    res.json({
      success: true,
      data: {
        penerimaanTunai,
        penerimaanQris,
        penerimaanTransfer,
        totalKasMasuk,
        totalPengeluaran,
        netCashFlow: totalKasMasuk - totalPengeluaran
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
