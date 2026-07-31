const db = require('../../db/models')
const { Op } = require('sequelize')

const performanceAggregation = {
  async aggregateKasirPerformance(store, reportDate) {
    try {
      const where = {
        store: store,
        paymentStatus: 'paid',
        createdAt: {
          [Op.gte]: new Date(`${reportDate} 00:00:00`),
          [Op.lte]: new Date(`${reportDate} 23:59:59`)
        }
      }

      const orders = await db.order.findAll({
        where,
        include: [
          { model: db.sales_return, as: 'returns' }
        ],
        attributes: ['id', 'cashierId', 'totalPrice', 'totalQuantity']
      })

      const kasirMap = {}
      orders.forEach(order => {
        const cashierId = order.cashierId
        if (!kasirMap[cashierId]) {
          kasirMap[cashierId] = {
            cashierId,
            store,
            reportDate,
            totalSales: 0,
            transactions: 0,
            itemsSold: 0,
            returns: 0
          }
        }
        kasirMap[cashierId].totalSales += Number(order.totalPrice) || 0
        kasirMap[cashierId].transactions += 1
        kasirMap[cashierId].itemsSold += Number(order.totalQuantity) || 0
        if (order.returns && order.returns.length > 0) {
          kasirMap[cashierId].returns += 1
        }
      })

      const results = []
      for (const [cashierId, data] of Object.entries(kasirMap)) {
        const avgTransaction = data.transactions > 0 
          ? Math.floor(data.totalSales / data.transactions)
          : 0
        const accuracyRate = data.transactions > 0
          ? ((data.transactions - data.returns) / data.transactions * 100)
          : 100

        const [perf] = await db.kasir_performance.findOrCreate({
          where: {
            store: data.store,
            cashier: parseInt(cashierId),
            report_date: data.reportDate
          },
          defaults: {
            total_sales: data.totalSales,
            transactions: data.transactions,
            avg_transaction: avgTransaction,
            items_sold: data.itemsSold,
            accuracy_rate: accuracyRate
          }
        })

        if (perf.wasCreated === false) {
          await perf.update({
            total_sales: data.totalSales,
            transactions: data.transactions,
            avg_transaction: avgTransaction,
            items_sold: data.itemsSold,
            accuracy_rate: accuracyRate
          })
        }

        results.push(perf)
      }

      return results
    } catch (error) {
      console.error('Error aggregating kasir performance:', error)
      throw error
    }
  },

  async triggerDailyAggregation(store) {
    try {
      const today = new Date().toISOString().split('T')[0]
      await this.aggregateKasirPerformance(store, today)
    } catch (error) {
      console.error('Error in daily aggregation:', error)
    }
  }
}

module.exports = performanceAggregation
