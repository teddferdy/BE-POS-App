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

    const totalRevenue = orders.reduce(
      (s, o) => s + Number(o.totalPrice || 0),
      0
    )
    const totalDiscount = orders.reduce(
      (s, o) => s + Number(o.discountAmount || 0),
      0
    )
    const netRevenue = totalRevenue - totalDiscount
    const totalOrders = orders.length
    const totalQty = orders.reduce(
      (s, o) => s + Number(o.totalQuantity || 0),
      0
    )

    let totalHpp = 0
    const orderIds = orders.map((o) => o.id)
    if (orderIds.length > 0) {
      const items = await OrderItem.findAll({ where: { order: orderIds } })
      totalHpp = items.reduce(
        (s, i) => s + Number(i.hppSnapshot || i.price || 0),
        0
      )
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
    const allOrderItems =
      orderIds.length > 0
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
      day.foodCostPersen =
        day.totalPenjualanBersih > 0
          ? Math.round((day.totalHpp / day.totalPenjualanBersih) * 10000) / 100
          : 0
      delete day.orderIds
    }

    const reportData = Object.values(dateMap).sort((a, b) =>
      b.tanggal.localeCompare(a.tanggal)
    )

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
    const totalRevenue = orders.reduce(
      (sum, o) => sum + Number(o.totalPrice || 0),
      0
    )
    const totalDiscount = orders.reduce(
      (sum, o) => sum + Number(o.discountAmount || 0),
      0
    )
    const netRevenue = totalRevenue - totalDiscount
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
    const marginPersen =
      netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 10000) / 100 : 0

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

exports.getSalesSummary = async (req, res) => {
  try {
    const { store } = req.cookies
    const { startDate, endDate, filter } = req.query

    let dateRange = {}
    if (filter === 'today') {
      const now = new Date()
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      dateRange = {
        [Op.gte]: s,
        [Op.lte]: new Date(s.getTime() + 86400000 - 1)
      }
    } else if (startDate && endDate) {
      dateRange = { [Op.gte]: new Date(startDate), [Op.lte]: new Date(endDate) }
    }

    const orderWhere = { paymentStatus: 'paid' }
    if (store) orderWhere.store = store
    if (dateRange[Op.gte]) orderWhere.createdAt = dateRange

    const [totalSales, totalOrders, activeLocations, totalMembers] =
      await Promise.all([
        Order.sum('totalPrice', { where: orderWhere }),
        Order.count({ where: orderWhere }),
        db.location.count({
          where: { status: 'active', ...(store ? { id: store } : {}) }
        }),
        db.member.count({ where: store ? { store } : {} })
      ])

    const totalSalesNum = Number(totalSales || 0)
    const totalOrdersNum = Number(totalOrders || 0)
    const avgTransaction =
      totalOrdersNum > 0 ? totalSalesNum / totalOrdersNum : 0

    // Sales chart by date
    const chartReplacements = { ...(store && { store }) }
    let chartWhere = `WHERE "paymentStatus" = 'paid'`
    if (store) chartWhere += ` AND "store" = :store`
    if (dateRange[Op.gte]) {
      chartWhere += ` AND "createdAt" >= :startDate AND "createdAt" <= :endDate`
      chartReplacements.startDate = dateRange[Op.gte]
      chartReplacements.endDate = dateRange[Op.lte]
    }

    const salesChart = await db.sequelize.query(
      `SELECT DATE("createdAt") as date, SUM("totalPrice") as sales, COUNT(*) as orders
       FROM "order" ${chartWhere}
       GROUP BY DATE("createdAt")
       ORDER BY date ASC`,
      { replacements: chartReplacements, type: db.sequelize.QueryTypes.SELECT }
    )

    // Per-store sales chart (multi-store support)
    const storeChartReplacements = { ...(store && { store }) }
    let storeChartWhere = `WHERE "paymentStatus" = 'paid'`
    if (store) storeChartWhere += ` AND "store" = :store`
    if (dateRange[Op.gte]) {
      storeChartWhere += ` AND "createdAt" >= :startDate AND "createdAt" <= :endDate`
      storeChartReplacements.startDate = dateRange[Op.gte]
      storeChartReplacements.endDate = dateRange[Op.lte]
    }

    const rawStoreChart = await db.sequelize.query(
      `SELECT "store", DATE("createdAt") as date, SUM("totalPrice") as sales, COUNT(*) as orders
       FROM "order" ${storeChartWhere}
       GROUP BY "store", DATE("createdAt")
       ORDER BY "store", date ASC`,
      {
        replacements: storeChartReplacements,
        type: db.sequelize.QueryTypes.SELECT
      }
    )

    // Group by storeId and merge with store names
    const storeChartMap = {}
    for (const row of rawStoreChart) {
      const sid = Number(row.store)
      if (!storeChartMap[sid]) storeChartMap[sid] = { storeId: sid, data: [] }
      storeChartMap[sid].data.push({
        date: row.date,
        sales: Number(row.sales || 0)
      })
    }

    // Store breakdown
    const storeWhere = store ? { id: store } : {}
    const locations = await db.location.findAll({
      where: { ...storeWhere },
      attributes: ['id', 'name', 'city']
    })

    const storePromises = locations.map(async (loc) => {
      const locWhere = { paymentStatus: 'paid', store: loc.id }
      if (dateRange[Op.gte]) locWhere.createdAt = dateRange
      const [sales, ordersCount] = await Promise.all([
        Order.sum('totalPrice', { where: locWhere }),
        Order.count({ where: locWhere })
      ])
      return {
        id: loc.id,
        name: loc.name,
        city: loc.city,
        sales: Number(sales || 0),
        transactions: Number(ordersCount || 0)
      }
    })
    const stores = await Promise.all(storePromises)

    // Merge store names into store chart
    const storeSalesChart = stores.map((s) => ({
      storeId: s.id,
      storeName: s.name,
      data: (storeChartMap[s.id]?.data || []).map((d) => ({
        date: d.date,
        sales: d.sales
      }))
    }))

    return res.status(200).json({
      success: true,
      data: {
        totalSales: totalSalesNum,
        totalOrders: totalOrdersNum,
        avgTransaction: Math.round(avgTransaction),
        totalCustomers: Number(totalMembers || 0),
        totalStores: Number(activeLocations || 0),
        salesChart: Array.isArray(salesChart) ? salesChart : [],
        storeSalesChart,
        stores
      }
    })
  } catch (err) {
    console.error('Sales summary error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

exports.getBestSellerReport = async (req, res) => {
  try {
    const { store } = req.cookies
    const { limit = 10 } = req.query

    const where = store ? { store } : {}

    const [bestSelling, productCount] = await Promise.all([
      db.best_selling.findAll({
        where,
        order: [['totalSelling', 'DESC']],
        limit: parseInt(limit),
        attributes: ['productId', 'nameProduct', 'totalSelling', 'image']
      }),
      db.product.count({
        where: { status: 'active', ...(store ? { store } : {}) }
      })
    ])

    const totalUnitsSold = bestSelling.reduce(
      (s, p) => s + Number(p.totalSelling || 0),
      0
    )
    return res.status(200).json({
      success: true,
      data: {
        bestSellers: bestSelling.map((p) => ({
          id: p.productId,
          name: p.nameProduct,
          image: p.image,
          sold: Number(p.totalSelling || 0),
          revenue: 0
        })),
        summary: {
          totalUnitsSold,
          totalRevenue: 0,
          activeProducts: Number(productCount || 0)
        }
      }
    })
  } catch (err) {
    console.error('Best seller report error:', err)
    return res.status(500).json({ success: false, message: err.message })
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
      else if (type.includes('transfer'))
        penerimaanTransfer += Number(p.amount || 0)
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
    const totalPengeluaran = expenses.reduce(
      (s, e) => s + Number(e.amount || 0),
      0
    )
    const totalKasMasuk =
      penerimaanTunai + penerimaanQris + penerimaanTransfer + lainnya

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
