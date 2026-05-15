const db = require('../../db/models')
const { Op } = require('sequelize')

const reportController = {
  async getDailySummary(req, res) {
    try {
      const { store } = req.cookies
      const { date } = req.query
      const targetDate = date || new Date().toISOString().split('T')[0]

      const startDate = new Date(targetDate + 'T00:00:00')
      const endDate = new Date(targetDate + 'T23:59:59')

      const orders = await db.order.findAll({
        where: {
          store,
          createdAt: { [Op.between]: [startDate, endDate] },
          paymentStatus: 'paid'
        },
        include: [
          { model: db.transaction, as: 'transactions' },
          { model: db.orderItem, as: 'items' }
        ]
      })

      const totalOrders = orders.length
      const totalRevenue = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0)

      let totalCost = 0
      for (const order of orders) {
        if (order.items) {
          for (const item of order.items) {
            const product = await db.product.findByPk(item.product)
            if (product) {
              totalCost += (product.costPrice || 0) * item.quantity
            }
          }
        }
      }

      const grossProfit = totalRevenue - totalCost

      const expenses = await db.expense.findAll({
        where: {
          store,
          date: { [Op.between]: [startDate, endDate] },
          status: 'approved'
        }
      })

      const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
      const netProfit = grossProfit - totalExpenses

      let totalItemsSold = 0
      for (const order of orders) {
        if (order.items) {
          totalItemsSold += order.items.reduce((sum, item) => sum + item.quantity, 0)
        }
      }

      let paymentBreakdown = {}
      for (const order of orders) {
        if (order.transactions) {
          for (const tx of order.transactions) {
            const method = tx.typePayment || 'cash'
            paymentBreakdown[method] = (paymentBreakdown[method] || 0) + tx.amount
          }
        }
      }

      let dailySummary = await db.dailySummary.findOne({
        where: { store, date: targetDate }
      })

      if (dailySummary) {
        await dailySummary.update({
          totalRevenue,
          totalCost,
          grossProfit,
          totalExpenses,
          netProfit,
          totalOrders,
          totalItemsSold,
          paymentBreakdown
        })
      } else {
        dailySummary = await db.dailySummary.create({
          store,
          date: targetDate,
          totalRevenue,
          totalCost,
          grossProfit,
          totalExpenses,
          netProfit,
          totalOrders,
          totalItemsSold,
          paymentBreakdown
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success get daily summary',
        data: dailySummary
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getProfitLoss(req, res) {
    try {
      const { store } = req.cookies
      const { startDate, endDate } = req.query

      const where = { store }

      if (startDate || endDate) {
        where.date = {}
        if (startDate) where.date[Op.gte] = startDate
        if (endDate) where.date[Op.lte] = endDate
      }

      const summaries = await db.dailySummary.findAll({
        where,
        order: [['date', 'ASC']]
      })

      let totalRevenue = 0
      let totalCost = 0
      let totalExpenses = 0

      for (const summary of summaries) {
        totalRevenue += summary.totalRevenue || 0
        totalCost += summary.totalCost || 0
        totalExpenses += summary.totalExpenses || 0
      }

      const grossProfit = totalRevenue - totalCost
      const netProfit = grossProfit - totalExpenses
      const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(2) : 0
      const netMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0

      return res.status(200).json({
        success: true,
        message: 'Success get profit/loss report',
        data: {
          summaries,
          totals: {
            totalRevenue,
            totalCost,
            grossProfit,
            totalExpenses,
            netProfit,
            grossMargin: parseFloat(grossMargin),
            netMargin: parseFloat(netMargin)
          }
        }
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getCashFlow(req, res) {
    try {
      const { store } = req.cookies
      const { startDate, endDate } = req.query

      const where = { store }

      if (startDate || endDate) {
        where.date = {}
        if (startDate) where.date[Op.gte] = startDate
        if (endDate) where.date[Op.lte] = endDate
      }

      const summaries = await db.dailySummary.findAll({
        where,
        order: [['date', 'ASC']]
      })

      let runningBalance = 0
      const cashFlows = summaries.map((summary) => {
        const inflow = summary.totalRevenue || 0
        const outflow = (summary.totalExpenses || 0) + (summary.totalCost || 0)
        const net = inflow - outflow
        runningBalance += net

        return {
          date: summary.date,
          openingBalance: runningBalance - net,
          inflow,
          outflow,
          net,
          closingBalance: runningBalance,
          totalOrders: summary.totalOrders,
          totalExpenses: summary.totalExpenses
        }
      })

      return res.status(200).json({
        success: true,
        message: 'Success get cash flow',
        data: {
          cashFlows,
          summary: {
            totalInflow: cashFlows.reduce((sum, cf) => sum + cf.inflow, 0),
            totalOutflow: cashFlows.reduce((sum, cf) => sum + cf.outflow, 0),
            netCashFlow: cashFlows.reduce((sum, cf) => sum + cf.net, 0),
            finalBalance: runningBalance
          }
        }
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getSalesReport(req, res) {
    try {
      const { store } = req.cookies
      const { startDate, endDate, groupBy = 'day' } = req.query

      const where = { store }

      if (startDate || endDate) {
        where.date = {}
        if (startDate) where.date[Op.gte] = startDate
        if (endDate) where.date[Op.lte] = endDate
      }

      const summaries = await db.dailySummary.findAll({
        where,
        order: [['date', 'ASC']]
      })

      let groupedData = []
      if (groupBy === 'day') {
        groupedData = summaries.map((s) => ({
          period: s.date,
          revenue: s.totalRevenue,
          orders: s.totalOrders,
          items: s.totalItemsSold,
          profit: s.netProfit
        }))
      } else if (groupBy === 'week') {
        const weekMap = {}
        for (const s of summaries) {
          const date = new Date(s.date)
          const weekStart = new Date(date.setDate(date.getDate() - date.getDay()))
          const weekKey = weekStart.toISOString().split('T')[0]

          if (!weekMap[weekKey]) {
            weekMap[weekKey] = { revenue: 0, orders: 0, items: 0, profit: 0 }
          }
          weekMap[weekKey].revenue += s.totalRevenue || 0
          weekMap[weekKey].orders += s.totalOrders || 0
          weekMap[weekKey].items += s.totalItemsSold || 0
          weekMap[weekKey].profit += s.netProfit || 0
        }
        groupedData = Object.entries(weekMap).map(([period, data]) => ({
          period,
          ...data
        }))
      } else if (groupBy === 'month') {
        const monthMap = {}
        for (const s of summaries) {
          const monthKey = s.date.substring(0, 7)

          if (!monthMap[monthKey]) {
            monthMap[monthKey] = { revenue: 0, orders: 0, items: 0, profit: 0 }
          }
          monthMap[monthKey].revenue += s.totalRevenue || 0
          monthMap[monthKey].orders += s.totalOrders || 0
          monthMap[monthKey].items += s.totalItemsSold || 0
          monthMap[monthKey].profit += s.netProfit || 0
        }
        groupedData = Object.entries(monthMap).map(([period, data]) => ({
          period,
          ...data
        }))
      }

      return res.status(200).json({
        success: true,
        message: 'Success get sales report',
        data: groupedData
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }
}

module.exports = reportController