/* eslint-disable no-unsafe-finally */
/* eslint-disable no-constant-condition */
/* eslint-disable no-unused-vars */
const BestSelling = require('../../db/models/best_selling')
const Checkout = require('../../db/models/checkout')
const { Op, Sequelize } = require('sequelize')
const moment = require('moment')
const sequelize = require('../../config/database')

// Get All List
exports.getAllBestSelling = async (req, res, next) => {
  try {
    const getAllBestSelling = await BestSelling.findAll().then((res) =>
      res.map((items) => {
        const getData = {
          ...items.dataValues
        }
        return getData
      })
    )

    return res.status(200).json({
      message: 'Success',
      data: getAllBestSelling?.length > 0 ? getAllBestSelling : []
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Chart get current year
exports.chartDataByYear = async (req, res, next) => {
  const { query } = req

  try {
    const [result] = await sequelize.query(`
        SELECT TO_CHAR(months.month, 'YYYY-MM') AS month, 
          coalesce(sum(co."totalPrice"), 0) as "totalAmount",
          coalesce(COUNT(co."dateCheckout"), 0) AS "countCheckout"
        from generate_series(
          (DATE '${query.year}-01-01'), 
          (DATE '${query.year}-12-31'), 
          '1 month') as months(month)
        left join checkout co on date_trunc('month', co."dateCheckout") = months.month
        group by months.month
          order by months.month ASC 
      `)

    return res.status(200).json({
      message: 'Success',
      data: result
    })
  } catch (error) {
    console.log('ERROR =>', error)

    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
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

// Charts by Month from first to endDate in Current Month
exports.chartDataByMonth = async (req, res, next) => {
  const { query } = req
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

  var dates = []
  for (let I = 0; I < Math.abs(arrIntervalDate.length); I++) {
    dates.push({
      date: moment(arrIntervalDate[I]).format('YYYY-MM-DD'),
      count: '0'
    })
  }

  try {
    const datas = await Checkout.findAll({
      where: {
        dateCheckout: {
          [Op.gte]: moment().subtract(numberLastDate, 'days').toDate()
        }
      },
      attributes: [
        [Sequelize.literal(`DATE("dateCheckout")`), 'date'],
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
      message: 'Success',
      data: datas.map((items) => {
        return {
          date: moment(items.date).format('DD-MM-YYYY'),
          count: Number(items.count)
        }
      })
    })
  } catch (error) {
    console.log('ERROR =>', error)
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Chart from now and 7 Days Before
exports.chartDataByCurrentDateAndSevenDaysBefore = async (req, res, next) => {
  var dates = []
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
    const datas = await Checkout.findAll({
      where: {
        dateCheckout: {
          [Op.gte]: moment().subtract(7, 'days').toDate()
        }
      },
      attributes: [
        [Sequelize.literal(`DATE("dateCheckout")`), 'date'],
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
      message: 'Success',
      data: datas.map((items) => {
        return {
          date: moment(items.date).format('DD-MM-YYYY'),
          count: Number(items.count)
        }
      })
    })
  } catch (error) {
    console.log('ERROR =>', error)

    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Chart from now and 2 Days Before
exports.chartDataByCurrentDateAndTwoDaysBefore = async (req, res, next) => {
  var dates = []
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
    const datas = await Checkout.findAll({
      where: {
        dateCheckout: {
          [Op.gte]: moment().subtract(2, 'days').toDate()
        }
      },
      attributes: [
        [Sequelize.literal(`DATE("dateCheckout")`), 'date'],
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
      message: 'Success',
      data: datas.map((items) => {
        return {
          date: moment(items.date).format('DD-MM-YYYY'),
          count: Number(items.count)
        }
      })
    })
  } catch (error) {
    console.log('ERROR =>', error)

    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}

// Get Earning Today
exports.getEarningToday = async (req, res, next) => {
  const NOW = moment(new Date()).format('YYYY-MM-DD')
  try {
    const datas = await Checkout.findAll({
      where: {
        dateCheckout: {
          [Op.gt]: NOW
        }
      }
    }).then((res) => {
      return res.map((items) => {
        const getData = {
          ...items.dataValues,
          totalPrice: Number(items.dataValues.totalPrice)
        }
        return getData
      })
    })

    let totalEarningToday = 0
    datas?.forEach((items) => {
      totalEarningToday += items.totalPrice
    })

    return res.status(200).json({
      message: 'Success',
      data: {
        totalEarningToday: totalEarningToday,
        totalSellingToday: datas.length
      }
    })
  } catch (error) {
    console.log('ERROR =>', error)

    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}
