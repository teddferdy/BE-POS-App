'use strict'
const daily = require('./daily')
const sales = require('./sales')
const cashFlow = require('./cashFlow')
const profitPerProduct = require('./profitPerProduct')
const bestSeller = require('./bestSeller')
const productSales = require('./productSales')
const categorySales = require('./categorySales')
const kasirPerformance = require('./kasirPerformance')

module.exports = {
  daily, sales, cashFlow, profitPerProduct,
  bestSeller, productSales, categorySales, kasirPerformance
}
