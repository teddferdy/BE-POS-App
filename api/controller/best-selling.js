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
      console.log('RES =>', res)
      return res.map((items) => {
        const getData = {
          ...items,
          date: items.date,
          count: Number(items.count)
        }
        return getData
      })
    })

    return res.status(200).json({
      message: 'Success',
      data: datas
    })
  } catch (error) {
    console.log('ERROR =>', error)

    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}
