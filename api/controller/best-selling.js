const db = require('../../db/models')
const Order = db.order
const { Op, Sequelize } = require('sequelize')
const moment = require('moment')
const sequelize = require('../../config/database')

exports.chartDataByYear = async (req, res) => {
  const { query } = req
  const { store, year } = query

  try {
    const yearVal = parseInt(year, 10) || new Date().getFullYear()
    const replacements = { year: yearVal }
    let storeCondition = ''
    if (store) {
      storeCondition = 'AND o."store" = :store'
      replacements.store = store
    }
    const [result] = await sequelize.query(
      `
        SELECT TO_CHAR(months.month, 'YYYY-MM') AS month, 
          coalesce(sum(o."totalPrice"), 0) as "totalAmount",
          coalesce(COUNT(o.id), 0) AS "countCheckout"
        FROM generate_series(
          make_date(:year::int, 1, 1), 
          make_date(:year::int, 12, 31), 
          '1 month') AS months(month)
        LEFT JOIN "order" o ON date_trunc('month', o."createdAt") = months.month AND o."paymentStatus" = 'paid'
        ${storeCondition}
        GROUP BY months.month
        ORDER BY months.month ASC
      `,
      { replacements }
    )

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: result
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

const getDateRange = (firstDate, lastDate) => {
  if (
    moment(firstDate, 'YYYY-MM-DD').isSame(
      moment(lastDate, 'YYYY-MM-DD'),
      'day'
    )
  )
    return [lastDate]
  let date = firstDate
  const dates = [date]
  do {
    date = moment(date).add(1, 'day')
    dates.push(date.format('YYYY-MM-DD'))
  } while (moment(date).isBefore(lastDate))
  return dates
}

exports.chartDataByMonth = async (req, res) => {
  const { query } = req
  const { store } = query
  const date = new Date()

  const firstDay = query?.startDate
    ? moment(query?.startDate).format('YYYY/MM/DD')
    : moment(new Date(date.getFullYear(), date.getMonth(), 1)).format(
        'YYYY/MM/DD'
      )
  const lastDay = query?.endDate
    ? moment(query?.endDate).format('YYYY/MM/DD')
    : moment(new Date(date.getFullYear(), date.getMonth() + 1, 0)).format(
        'YYYY/MM/DD'
      )
  const numberLastDate = moment(lastDay).format('DD')
  const arrIntervalDate = getDateRange(firstDay, lastDay)

  let dates = []
  for (let I = 0; I < Math.abs(arrIntervalDate.length); I++) {
    dates.push({
      date: moment(arrIntervalDate[I]).format('YYYY-MM-DD'),
      count: '0'
    })
  }

  try {
    const whereClause = {
      paymentStatus: 'paid',
      createdAt: {
        [Op.gte]: moment().subtract(numberLastDate, 'days').toDate()
      }
    }

    if (store) {
      whereClause.store = store
    }

    const datas = await Order.findAll({
      where: whereClause,
      attributes: [
        [Sequelize.literal(`DATE("createdAt")`), 'date'],
        [Sequelize.literal(`COUNT(*)`), 'count']
      ],
      raw: true,
      group: ['date']
    }).then((res) => {
      let map = {}
      dates.forEach((item) => (map[item.date] = item))
      res.forEach((item) => (map[item.date] = item))
      const result = Object.values(map)
      return result
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: datas.map((items) => {
        return {
          date: moment(items.date).format('DD-MM-YYYY'),
          count: Number(items.count)
        }
      })
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.chartDataByCurrentDateAndSevenDaysBefore = async (req, res) => {
  const dates = []
  for (let I = 0; I < Math.abs(7); I++) {
    dates.push({
      date: moment(
        new Date(
          new Date().getTime() - (7 >= 0 ? I : I - I - I) * 24 * 60 * 60 * 1000
        ).toLocaleString()
      ).format('YYYY-MM-DD'),
      count: '0'
    })
  }

  try {
    const datas = await Order.findAll({
      where: {
        paymentStatus: 'paid',
        createdAt: {
          [Op.gte]: moment().subtract(7, 'days').toDate()
        }
      },
      attributes: [
        [Sequelize.literal(`DATE("createdAt")`), 'date'],
        [Sequelize.literal(`COUNT(*)`), 'count']
      ],
      raw: true,
      group: ['date']
    }).then((res) => {
      let map = {}
      dates.forEach((item) => (map[item.date] = item))
      res.forEach((item) => (map[item.date] = item))
      const result = Object.values(map)
      return result
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: datas.map((items) => {
        return {
          date: moment(items.date).format('DD-MM-YYYY'),
          count: Number(items.count)
        }
      })
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.chartDataByCurrentDateAndTwoDaysBefore = async (req, res) => {
  const dates = []
  for (let I = 0; I < Math.abs(2); I++) {
    dates.push({
      date: moment(
        new Date(
          new Date().getTime() - (2 >= 0 ? I : I - I - I) * 24 * 60 * 60 * 1000
        ).toLocaleString()
      ).format('YYYY-MM-DD'),
      count: '0'
    })
  }

  try {
    const datas = await Order.findAll({
      where: {
        paymentStatus: 'paid',
        createdAt: {
          [Op.gte]: moment().subtract(2, 'days').toDate()
        }
      },
      attributes: [
        [Sequelize.literal(`DATE("createdAt")`), 'date'],
        [Sequelize.literal(`COUNT(*)`), 'count']
      ],
      raw: true,
      group: ['date']
    }).then((res) => {
      let map = {}
      dates.forEach((item) => (map[item.date] = item))
      res.forEach((item) => (map[item.date] = item))
      const result = Object.values(map)
      return result
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: datas.map((items) => {
        return {
          date: moment(items.date).format('DD-MM-YYYY'),
          count: Number(items.count)
        }
      })
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.getEarningToday = async (req, res) => {
  const NOW = new Date()
  NOW.setHours(0, 0, 0, 0)
  const { store } = req.query

  try {
    const replacements = { today: NOW }
    let conditions = `"paymentStatus" = 'paid' AND "createdAt" >= :today`

    if (store) {
      conditions += ` AND "store" = :store`
      replacements.store = store
    }

    const [result] = await db.sequelize.query(
      `SELECT COUNT(*) as "totalSellingToday",
              COALESCE(SUM(COALESCE("totalPrice", 0)), 0) as "totalEarningToday"
       FROM "order"
       WHERE ${conditions}`,
      { replacements, type: db.sequelize.QueryTypes.SELECT }
    )

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: {
        totalEarningToday: Number(result.totalEarningToday || 0),
        totalSellingToday: Number(result.totalSellingToday || 0)
      }
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}
