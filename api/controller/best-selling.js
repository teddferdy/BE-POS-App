/* eslint-disable no-unused-vars */
const BestSelling = require('../../db/models/best_selling')
const Checkout = require('../../db/models/checkout')
const { Op, Sequelize } = require('sequelize')

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
exports.chartData = async (req, res, next) => {
  const { query } = req
  try {
    const getAllBestSelling = await Checkout.findAll({
      where: {
        dateCheckout: {
          [Op.between]: [query.startDate, query.endDate]
        }
      },
      raw: true,
      attributes: [
        [Sequelize.literal(`DATE("dateCheckout")`), 'date'],
        [Sequelize.literal(`COUNT(*)`), 'count']
      ],
      group: ['date']
    }).then((res) => {
      console.log('RES =>', res)
      return res.map((items) => {
        const getData = {
          ...items
        }
        return getData
      })
    })

    return res.status(200).json({
      message: 'Success',
      data: getAllBestSelling
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  }
}
