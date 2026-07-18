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
    const replacements = {}
    let orderConditions = `"paymentStatus" = 'paid'`

    if (store) {
      orderConditions += ` AND o."store" = :store`
      replacements.store = store
    }
    if (startDate) {
      orderConditions += ` AND o."createdAt" >= :startDate`
      replacements.startDate = new Date(startDate)
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      orderConditions += ` AND o."createdAt" <= :endDate`
      replacements.endDate = end
    }

    // Aggregate order-level metrics per day in SQL
    const dailyOrders = await db.sequelize.query(
      `SELECT DATE(o."createdAt") as tanggal,
              COUNT(*) as "totalTransaksi",
              COALESCE(SUM(o."totalPrice"), 0) as "totalPenjualan",
              COALESCE(SUM(o."discountAmount"), 0) as "totalDiscount",
              COALESCE(SUM(o."totalQuantity"), 0) as "totalQty",
              COALESCE(SUM(o."totalCovers"), 0) as "totalCovers"
       FROM "order" o
       WHERE ${orderConditions}
       GROUP BY DATE(o."createdAt")
       ORDER BY tanggal DESC`,
      { replacements, type: db.sequelize.QueryTypes.SELECT }
    )

    if (dailyOrders.length === 0) {
      return res.json({ success: true, data: [] })
    }

    // Aggregate HPP per day from order_items joined with orders
    const dailyHpp = await db.sequelize.query(
      `SELECT DATE(o."createdAt") as tanggal,
              COALESCE(SUM(COALESCE(oi."hppSnapshot", oi."price", 0)), 0) as "totalHpp"
       FROM order_item oi
       JOIN "order" o ON o.id = oi."order"
       WHERE ${orderConditions}
       GROUP BY DATE(o."createdAt")`,
      { replacements, type: db.sequelize.QueryTypes.SELECT }
    )

    const hppMap = {}
    for (const row of dailyHpp) {
      hppMap[row.tanggal] = Number(row.totalHpp || 0)
    }

    // Aggregate expenses per day
    let expenseConditions = `"status" = 'approved'`
    const expReplacements = {}
    if (store) {
      expenseConditions += ` AND "store" = :store`
      expReplacements.store = store
    }
    if (startDate) {
      expenseConditions += ` AND "date" >= :startDate`
      expReplacements.startDate = replacements.startDate
    }
    if (endDate) {
      expenseConditions += ` AND "date" <= :endDate`
      expReplacements.endDate = replacements.endDate
    }

    let dailyExpenses = []
    if (startDate || endDate || store) {
      dailyExpenses = await db.sequelize.query(
        `SELECT DATE("date") as tanggal, COALESCE(SUM("amount"), 0) as "totalExpense"
         FROM expense
         WHERE ${expenseConditions}
         GROUP BY DATE("date")`,
        { replacements: expReplacements, type: db.sequelize.QueryTypes.SELECT }
      )
    }

    const expenseMap = {}
    for (const row of dailyExpenses) {
      expenseMap[row.tanggal] = Number(row.totalExpense || 0)
    }

    // Build final report
    const reportData = dailyOrders.map((row) => {
      const tanggal = row.tanggal
      const totalPenjualan = Number(row.totalPenjualan || 0)
      const totalDiscount = Number(row.totalDiscount || 0)
      const netRevenue = totalPenjualan - totalDiscount
      const totalHpp = hppMap[tanggal] || 0
      const totalExpense = expenseMap[tanggal] || 0
      const grossProfit = netRevenue - totalHpp
      const netProfit = grossProfit - totalExpense
      const foodCostPersen =
        totalPenjualan > 0
          ? Math.round((totalHpp / totalPenjualan) * 10000) / 100
          : 0

      return {
        tanggal,
        totalTransaksi: Number(row.totalTransaksi || 0),
        totalPenjualanBersih: netRevenue,
        totalHpp,
        foodCostPersen,
        grossProfit,
        netProfit,
        totalCovers: Number(row.totalCovers || 0) || Number(row.totalQty || 0)
      }
    })

    res.json({ success: true, data: reportData })
  } catch (err) {
    console.error('Daily report error:', err)
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.getProfitLoss = async (req, res) => {
  try {
    const { store, startDate, endDate } = req.query
    const replacements = {}
    let orderConditions = `"paymentStatus" = 'paid'`

    if (store) {
      orderConditions += ` AND "store" = :store`
      replacements.store = store
    }
    if (startDate) {
      orderConditions += ` AND "createdAt" >= :startDate`
      replacements.startDate = new Date(startDate)
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      orderConditions += ` AND "createdAt" <= :endDate`
      replacements.endDate = end
    }

    const [orderAgg] = await db.sequelize.query(
      `SELECT COALESCE(SUM("totalPrice"), 0) as "totalRevenue",
              COALESCE(SUM("discountAmount"), 0) as "totalDiscount"
       FROM "order"
       WHERE ${orderConditions}`,
      { replacements, type: db.sequelize.QueryTypes.SELECT }
    )

    const [hppAgg] = await db.sequelize.query(
      `SELECT COALESCE(SUM(COALESCE(oi."hppSnapshot", oi."price", 0)), 0) as "totalHpp"
       FROM order_item oi
       JOIN "order" o ON o.id = oi."order"
       WHERE ${orderConditions}`,
      { replacements, type: db.sequelize.QueryTypes.SELECT }
    )

    const totalRevenue = Number(orderAgg.totalRevenue || 0)
    const totalDiscount = Number(orderAgg.totalDiscount || 0)
    const netRevenue = totalRevenue - totalDiscount
    const totalHpp = Number(hppAgg.totalHpp || 0)
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
    const now = new Date()
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    )
    if (filter === 'today') {
      dateRange = {
        [Op.gte]: todayStart,
        [Op.lte]: new Date(todayStart.getTime() + 86400000 - 1)
      }
    } else if (filter === 'weekly') {
      const daysSinceMonday = (now.getDay() + 6) % 7
      const monday = new Date(todayStart)
      monday.setDate(todayStart.getDate() - daysSinceMonday)
      dateRange = {
        [Op.gte]: monday,
        [Op.lte]: new Date(monday.getTime() + 7 * 86400000 - 1)
      }
    } else if (filter === 'monthly') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      )
      dateRange = { [Op.gte]: monthStart, [Op.lte]: monthEnd }
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

    const chartReplacements = { ...(store && { store }) }
    let chartWhere = `WHERE "paymentStatus" = 'paid'`
    if (store) chartWhere += ` AND "store" = :store`
    if (dateRange[Op.gte]) {
      chartWhere += ` AND "createdAt" >= :startDate AND "createdAt" <= :endDate`
      chartReplacements.startDate = dateRange[Op.gte]
      chartReplacements.endDate = dateRange[Op.lte]
    }

    let salesChart = await db.sequelize.query(
      `SELECT DATE("createdAt") as date, SUM("totalPrice") as sales, COUNT(*) as orders
       FROM "order" ${chartWhere}
       GROUP BY DATE("createdAt") ORDER BY date ASC`,
      { replacements: chartReplacements, type: db.sequelize.QueryTypes.SELECT }
    )

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
       GROUP BY "store", DATE("createdAt") ORDER BY "store", date ASC`,
      {
        replacements: storeChartReplacements,
        type: db.sequelize.QueryTypes.SELECT
      }
    )

    const storeChartMap = {}
    for (const row of rawStoreChart) {
      const sid = Number(row.store)
      if (!storeChartMap[sid]) storeChartMap[sid] = { storeId: sid, data: [] }
      storeChartMap[sid].data.push({
        date: row.date,
        sales: Number(row.sales || 0)
      })
    }

    const storeWhere = store ? { id: store } : {}
    const locations = await db.location.findAll({
      where: storeWhere,
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

    const storeSalesChart = stores.map((s) => ({
      storeId: s.id,
      storeName: s.name,
      data: (storeChartMap[s.id]?.data || []).map((d) => ({
        date: d.date,
        sales: d.sales
      }))
    }))

    const padChartData = (data, start, end) => {
      if (!data.length) return data
      const s = new Date(start)
      const e = new Date(end)
      const map = {}
      for (const d of data) map[d.date] = d
      const result = []
      const cur = new Date(s)
      while (cur <= e) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
        result.push(map[key] || { date: key, sales: 0, orders: 0 })
        cur.setDate(cur.getDate() + 1)
      }
      return result
    }
    if (dateRange[Op.gte] && dateRange[Op.lte]) {
      salesChart = padChartData(
        salesChart,
        dateRange[Op.gte],
        dateRange[Op.lte]
      )
      for (const s of storeSalesChart)
        s.data = padChartData(s.data, dateRange[Op.gte], dateRange[Op.lte])
    }

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

    const [bestSelling, productCount, productRevenues] = await Promise.all([
      db.best_selling.findAll({
        where,
        order: [['totalSelling', 'DESC']],
        limit: parseInt(limit),
        attributes: ['productId', 'nameProduct', 'totalSelling', 'image']
      }),
      db.product.count({
        where: { status: 'active', ...(store ? { store } : {}) }
      }),
      db.sequelize.query(
        `SELECT oi.product, COALESCE(SUM(oi."totalPrice"), 0) as revenue
         FROM order_item oi
         JOIN "order" o ON o.id = oi."order"
         WHERE o."paymentStatus" = 'paid'${store ? ' AND o.store = :store' : ''}
         GROUP BY oi.product`,
        {
          replacements: store ? { store } : {},
          type: db.sequelize.QueryTypes.SELECT
        }
      )
    ])

    const revenueMap = {}
    for (const r of productRevenues)
      revenueMap[Number(r.product)] = Number(r.revenue || 0)

    const totalUnitsSold = bestSelling.reduce(
      (s, p) => s + Number(p.totalSelling || 0),
      0
    )
    const totalRevenue = bestSelling.reduce(
      (s, p) => s + (revenueMap[Number(p.productId)] || 0),
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
          revenue: revenueMap[Number(p.productId)] || 0
        })),
        summary: {
          totalUnitsSold,
          totalRevenue,
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
    const replacements = {}
    let txConditions = '1=1'

    if (store) {
      txConditions += ` AND t."store" = :store`
      replacements.store = store
    }
    if (startDate) {
      txConditions += ` AND t."createdAt" >= :startDate`
      replacements.startDate = new Date(startDate)
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      txConditions += ` AND t."createdAt" <= :endDate`
      replacements.endDate = end
    }

    // Aggregate payment breakdown by type in SQL
    const paymentRows = await db.sequelize.query(
      `SELECT t."typePayment",
              COALESCE(SUM(t."amount"), 0) as total
       FROM "transaction" t
       WHERE ${txConditions}
       GROUP BY t."typePayment"`,
      { replacements, type: db.sequelize.QueryTypes.SELECT }
    )

    let penerimaanTunai = 0
    let penerimaanQris = 0
    let penerimaanTransfer = 0
    let lainnya = 0

    for (const row of paymentRows) {
      const type = (row.typePayment || '').toLowerCase()
      const amount = Number(row.total || 0)
      if (type.includes('cash') || type === 'tunai') penerimaanTunai += amount
      else if (type.includes('qris')) penerimaanQris += amount
      else if (type.includes('transfer')) penerimaanTransfer += amount
      else lainnya += amount
    }

    // Aggregate expenses in SQL
    const expReplacements = {}
    let expConditions = `"status" = 'approved'`
    if (store) {
      expConditions += ` AND "store" = :store`
      expReplacements.store = store
    }
    if (startDate) {
      expConditions += ` AND "date" >= :startDate`
      expReplacements.startDate = replacements.startDate
    }
    if (endDate) {
      expConditions += ` AND "date" <= :endDate`
      expReplacements.endDate = replacements.endDate
    }

    const [expAgg] = await db.sequelize.query(
      `SELECT COALESCE(SUM("amount"), 0) as total
       FROM expense
       WHERE ${expConditions}`,
      { replacements: expReplacements, type: db.sequelize.QueryTypes.SELECT }
    )

    const totalPengeluaran = Number(expAgg.total || 0)
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

exports.getProfitPerProduct = async (req, res) => {
  try {
    const { store, startDate, endDate } = req.query
    const replacements = {}
    let orderConditions = `o."paymentStatus" = 'paid'`

    if (store) {
      orderConditions += ` AND o."store" = :store`
      replacements.store = store
    }
    if (startDate) {
      orderConditions += ` AND o."createdAt" >= :startDate`
      replacements.startDate = new Date(startDate)
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      orderConditions += ` AND o."createdAt" <= :endDate`
      replacements.endDate = end
    }

    // Single SQL query: GROUP BY product with SUM for qty, revenue, HPP
    const rows = await db.sequelize.query(
      `SELECT oi."product" as "productId",
              COALESCE(MAX(oi."productName"), 'Unknown') as "productName",
              COALESCE(SUM(oi."quantity"), 0) as "qtySold",
              COALESCE(SUM(oi."totalPrice"), 0) as "totalSales",
              COALESCE(SUM(COALESCE(oi."hppSnapshot", 0)), 0) as "totalHpp"
       FROM order_item oi
       JOIN "order" o ON o.id = oi."order"
       WHERE ${orderConditions}
       GROUP BY oi."product"
       ORDER BY ("totalSales" - "totalHpp") DESC`,
      { replacements, type: db.sequelize.QueryTypes.SELECT }
    )

    const result = rows.map((r) => {
      const totalSales = Number(r.totalSales || 0)
      const totalHpp = Number(r.totalHpp || 0)
      const profit = totalSales - totalHpp
      return {
        productId: r.productId,
        productName: r.productName,
        qtySold: Number(r.qtySold || 0),
        totalSales,
        totalHpp,
        profit,
        margin:
          totalSales > 0 ? Math.round((profit / totalSales) * 10000) / 100 : 0
      }
    })

    res.json({ success: true, data: result })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
