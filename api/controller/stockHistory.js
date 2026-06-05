const db = require('../../db/models')
const { Op } = require('sequelize')

const stockHistoryController = {
  async getAll(req, res) {
    try {
      const { referenceType, product, startDate, endDate, page = 1, limit = 50 } = req.query

      const where = {}

      if (referenceType) {
        where.referenceType = referenceType
      }

      if (product) {
        where.product = product
      }

      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt[Op.gte] = new Date(startDate)
        if (endDate) where.createdAt[Op.lte] = new Date(endDate + 'T23:59:59')
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const { count, rows } = await db.stock_history.findAndCountAll({
        where,
        include: [
          {
            model: db.product,
            as: 'productData',
            attributes: ['id', 'nameProduct']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      return res.status(200).json({
        success: true,
        message: 'Success get stock history',
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
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

  async getByProduct(req, res) {
    try {
      const { productId } = req.params

      const history = await db.stock_history.findAll({
        where: { product: productId },
        order: [['createdAt', 'DESC']]
      })

      return res.status(200).json({
        success: true,
        message: 'Success get product stock history',
        data: history
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getByIngredient(req, res) {
    try {
      const { ingredientName } = req.params
      const { store } = req.cookies

      const history = await db.stock_history.findAll({
        where: { store, ingredientName },
        order: [['createdAt', 'DESC']]
      })

      return res.status(200).json({
        success: true,
        message: 'Success get ingredient stock history',
        data: history
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getLowStock(req, res) {
    try {
      const store = req.cookies?.store || req.query?.store

      const products = await db.product.findAll({
        where: {
          status: 'active',
          minStock: { [Op.gt]: 0 }
        },
        attributes: ['id', 'nameProduct', 'stock', 'minStock', 'unit']
      })

      const lowStockProducts = products.filter(
        (p) => p.stock <= p.minStock
      )

      const ingredientWhere = { status: 'active' }
      if (store) {
        ingredientWhere.store = store
      }
      const ingredients = await db.ingredient.findAll({
        where: ingredientWhere,
        attributes: ['id', 'name', 'stock', 'minStock', 'unit']
      })

      const lowStockIngredients = ingredients.filter(
        (i) => i.stock <= i.minStock
      )

      return res.status(200).json({
        success: true,
        message: 'Success get low stock items',
        data: {
          products: lowStockProducts,
          ingredients: lowStockIngredients,
          totalProducts: lowStockProducts.length,
          totalIngredients: lowStockIngredients.length
        }
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

module.exports = stockHistoryController