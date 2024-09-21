/* eslint-disable no-constant-condition */
/* eslint-disable no-unused-vars */
const BestSelling = require('../../db/models/best_selling')
const Checkout = require('../../db/models/checkout')
const { Op, Sequelize } = require('sequelize')
const moment = require('moment')

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
  }
}

// Cart
// exports.chartData = async (req, res, next) => {
//   const { query } = req

//   const Month = [
//     'January',
//     'February',
//     'March',
//     'April',
//     'May',
//     'June',
//     'July',
//     'August',
//     'September',
//     'October',
//     'November',
//     'December'
//   ]

//   try {
//     const getAllBestSelling = await Checkout.findAll({
//       where: {
//         dateCheckout: {
//           [Op.between]: [query.startDate, query.endDate]
//         }
//       },
//       raw: true,
//       attributes: [
//         [Sequelize.literal(`DATE("dateCheckout")`), 'date'],
//         [Sequelize.literal(`COUNT(*)`), 'count']
//       ],
//       group: ['date']
//     }).then((res) => {
//       console.log('RES =>', res)
//       const newFormat = res.map((items) => {
//         return {
//           date: new Date(items.date).toUTCString(),
//           count: items.count
//         }
//       })
//       var resultProductData = newFormat.filter((val) => {
//         console.log('VAL =>', val)

//         return val.date >= query.startDate && val.date <= query.endDate

//         // console.log('WKWKWK', newFormat)
//       })

//       console.log('resultProductData =>', resultProductData)

//       // console.log('resultProductData =>', resultProductData)

//       // return res.map((items) => {
//       //   const getData = {
//       //     ...items
//       //   }
//       //   return getData
//       // })
//     })

//     return res.status(200).json({
//       message: 'Success',
//       data: getAllBestSelling
//     })
//   } catch (error) {
//     console.log('ERROR =>', error)

//     return res.status(500).json({
//       error: 'Terjadi Kesalahan Internal Server'
//     })
//   }
// }

// Charts by Month from first to endDate in Current Month
// exports.chartDataByCurrentDate = async (req, res, next) => {
//   const { query } = req
//   const date = new Date()

//   const lastDay = moment(
//     new Date(date.getFullYear(), date.getMonth() + 1, 0)
//   ).format('DD')

//   console.log('lastDay =>', lastDay)

//   try {
//     const arrDate = []

//     for (let index = 1; index <= lastDay; index++) arrDate.push(index)

//     console.log('arrDate =>', arrDate)

//     const getAllBestSelling = await Checkout.findAll({
//       where: {
//         dateCheckout: {
//           [Op.between]: [query.startDate, query.endDate]
//         }
//       },
//       raw: true,
//       attributes: [
//         [Sequelize.literal(`DATE("dateCheckout")`), 'date'],
//         [Sequelize.literal(`COUNT(*)`), 'count']
//       ],
//       group: ['date']
//     }).then((res) => {
//       console.log('RES =>', res)
//       const newFormat = res.map((items) => {
//         return {
//           date: Number(moment(items.date).format('DD')),
//           count: Number(items.count)
//         }
//       })

//       console.log('NEW FORMAT =>', newFormat)

//       // arrDate.map((items, index) => {
//       //   return {
//       //     date: res[index].date
//       //   }
//       // })

//       return res.map((items) => {
//         const getData = {
//           ...items
//         }
//         return getData
//       })
//     })

//     console.log('getAllBestSelling =>', getAllBestSelling)

//     return res.status(200).json({
//       message: 'Success',
//       data: getAllBestSelling
//     })
//   } catch (error) {
//     return res.status(500).json({
//       error: 'Terjadi Kesalahan Internal Server'
//     })
//   }
// }

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
  }
}
