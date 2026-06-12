'use strict'
const { Op } = require('sequelize')
const db = require('../../db/models')
const DailyReport = db.daily_report
const Order = db.order
const OrderItem = db.order_item
const Transaction = db.transaction
const Expense = db.expense

exports.getDailyReport = async (req, res) => {
  try {
    const { store, startDate, endDate } = req.query
    const where = {}
    if (store) where.store = store
    if (startDate || endDate) {
      where.tanggal = {}
      if (startDate) where.tanggal[Op.gte] = startDate
      if (endDate) where.tanggal[Op.lte] = endDate
    }
    const reports = await DailyReport.findAll({
      where,
      order: [['tanggal', 'DESC']]
    })
    res.json({ success: true, data: reports })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.getProfitLoss = async (req, res) => {
  try {
    const { store, startDate, endDate } = req.query
    const orderWhere = { status: 'paid' }
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
    const totalRevenue = orders.reduce(
      (sum, o) => sum + Number(o.totalPrice || 0),
      0
    )
    const totalDiscount = orders.reduce(
      (sum, o) => sum + Number(o.discountAmount || 0),
      0
    )
    const netRevenue = totalRevenue - totalDiscount
    // HPP from order items (simplified)
    const orderIds = orders.map((o) => o.id)
    const items =
      orderIds.length > 0
        ? await OrderItem.findAll({ where: { order: orderIds } })
        : []
    const totalHpp = items.reduce(
      (sum, i) => sum + Number(i.hppSnapshot || i.price || 0),
      0
    )
    const grossProfit = netRevenue - totalHpp
    res.json({
      success: true,
      data: {
        totalRevenue,
        totalDiscount,
        netRevenue,
        totalHpp,
        grossProfit,
        grossMargin:
          netRevenue > 0
            ? Math.round((grossProfit / netRevenue) * 10000) / 100
            : 0
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
    const cashIn = { tunai: 0, qris: 0, transfer: 0, lainnya: 0 }
    payments.forEach((p) => {
      const type = (p.typePayment || '').toLowerCase()
      if (type.includes('cash') || type === 'tunai')
        cashIn.tunai += Number(p.amount || 0)
      else if (type.includes('qris')) cashIn.qris += Number(p.amount || 0)
      else if (type.includes('transfer'))
        cashIn.transfer += Number(p.amount || 0)
      else cashIn.lainnya += Number(p.amount || 0)
    })
    res.json({ success: true, data: cashIn })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
