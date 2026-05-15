const db = require('../../db/models')
const { Op } = require('sequelize')

const generateOpnameNumber = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')
  return `SO-${year}${month}${day}-${random}`
}

const stockOpnameController = {
  async getAll(req, res) {
    try {
      const { store } = req.cookies
      const { status, startDate, endDate } = req.query

      const where = { store }

      if (status) {
        where.status = status
      }

      if (startDate || endDate) {
        where.date = {}
        if (startDate) where.date[Op.gte] = new Date(startDate)
        if (endDate) where.date[Op.lte] = new Date(endDate)
      }

      const opnames = await db.stockOpname.findAll({
        where,
        include: [
          {
            model: db.user,
            as: 'creator',
            attributes: ['id', 'name']
          },
          {
            model: db.stockOpnameItem,
            as: 'items'
          }
        ],
        order: [['createdAt', 'DESC']]
      })

      return res.status(200).json({
        success: true,
        message: 'Success get stock opnames',
        data: opnames
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies

      const opname = await db.stockOpname.findOne({
        where: { id, store },
        include: [
          {
            model: db.user,
            as: 'creator',
            attributes: ['id', 'name']
          },
          {
            model: db.stockOpnameItem,
            as: 'items',
            include: [
              {
                model: db.product,
                as: 'productData',
                attributes: ['id', 'nameProduct']
              }
            ]
          }
        ]
      })

      if (!opname) {
        return res.status(404).json({
          success: false,
          message: 'Stock opname not found'
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success get stock opname',
        data: opname
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async create(req, res) {
    try {
      const { store } = req.cookies
      const { items, notes, date } = req.body
      const createdBy = req.user?.id || null

      if (!items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Items are required'
        })
      }

      const opnameNumber = generateOpnameNumber()

      const totalAdjustment = items.reduce((sum, item) => {
        return sum + item.adjustment
      }, 0)

      const opname = await db.stockOpname.create({
        store,
        opnameNumber,
        date: date || new Date(),
        totalAdjustment,
        status: 'draft',
        notes,
        createdBy
      })

      const opnameItems = items.map((item) => ({
        stockOpname: opname.id,
        product: item.product || null,
        ingredientName: item.ingredientName || null,
        systemStock: item.systemStock,
        actualStock: item.actualStock,
        adjustment: item.adjustment || 0,
        unit: item.unit || 'pcs',
        notes: item.notes || null
      }))

      await db.stockOpnameItem.bulkCreate(opnameItems)

      return res.status(201).json({
        success: true,
        message: 'Success create stock opname',
        data: opname
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies
      const { items, notes, date } = req.body

      const opname = await db.stockOpname.findOne({
        where: { id, store }
      })

      if (!opname) {
        return res.status(404).json({
          success: false,
          message: 'Stock opname not found'
        })
      }

      if (opname.status === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Cannot update completed stock opname'
        })
      }

      if (items) {
        await db.stockOpnameItem.destroy({
          where: { stockOpname: id }
        })

        const opnameItems = items.map((item) => ({
          stockOpname: id,
          product: item.product || null,
          ingredientName: item.ingredientName || null,
          systemStock: item.systemStock,
          actualStock: item.actualStock,
          adjustment: item.adjustment || 0,
          unit: item.unit || 'pcs',
          notes: item.notes || null
        }))

        await db.stockOpnameItem.bulkCreate(opnameItems)
      }

      const allItems = await db.stockOpnameItem.findAll({
        where: { stockOpname: id }
      })

      const totalAdjustment = allItems.reduce((sum, item) => {
        return sum + item.adjustment
      }, 0)

      await opname.update({
        totalAdjustment,
        notes: notes !== undefined ? notes : opname.notes,
        date: date || opname.date
      })

      return res.status(200).json({
        success: true,
        message: 'Success update stock opname',
        data: opname
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async complete(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies

      const opname = await db.stockOpname.findOne({
        where: { id, store },
        include: [{ model: db.stockOpnameItem, as: 'items' }]
      })

      if (!opname) {
        return res.status(404).json({
          success: false,
          message: 'Stock opname not found'
        })
      }

      if (opname.status === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Stock opname already completed'
        })
      }

      const transaction = await db.sequelize.transaction()

      try {
        for (const item of opname.items) {
          if (item.product) {
            const product = await db.product.findByPk(item.product, { transaction })
            if (product) {
              const quantityBefore = product.stock
              const quantityAfter = item.actualStock
              const quantityChange = quantityAfter - quantityBefore

              await db.stockHistory.create(
                {
                  store,
                  product: item.product,
                  referenceType: 'opname',
                  referenceId: id,
                  quantityBefore,
                  quantityChange,
                  quantityAfter,
                  unit: item.unit,
                  notes: item.notes,
                  createdBy: req.user?.id
                },
                { transaction }
              )

              await product.update(
                { stock: quantityAfter },
                { transaction }
              )
            }
          }

          if (item.ingredientName) {
            const ingredient = await db.ingredient.findOne({
              where: { name: item.ingredientName, store },
              transaction
            })

            if (ingredient) {
              const quantityBefore = ingredient.stock
              const quantityAfter = item.actualStock
              const quantityChange = quantityAfter - quantityBefore

              await db.stockHistory.create(
                {
                  store,
                  ingredientName: item.ingredientName,
                  referenceType: 'opname',
                  referenceId: id,
                  quantityBefore,
                  quantityChange,
                  quantityAfter,
                  unit: item.unit,
                  notes: item.notes,
                  createdBy: req.user?.id
                },
                { transaction }
              )

              await ingredient.update(
                { stock: quantityAfter },
                { transaction }
              )
            }
          }
        }

        await opname.update(
          { status: 'completed' },
          { transaction }
        )

        await transaction.commit()

        return res.status(200).json({
          success: true,
          message: 'Success complete stock opname',
          data: opname
        })
      } catch (err) {
        await transaction.rollback()
        throw err
      }
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async cancel(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies

      const opname = await db.stockOpname.findOne({
        where: { id, store }
      })

      if (!opname) {
        return res.status(404).json({
          success: false,
          message: 'Stock opname not found'
        })
      }

      if (opname.status === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel completed stock opname'
        })
      }

      await opname.update({ status: 'cancelled' })

      return res.status(200).json({
        success: true,
        message: 'Success cancel stock opname'
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies

      const opname = await db.stockOpname.findOne({
        where: { id, store }
      })

      if (!opname) {
        return res.status(404).json({
          success: false,
          message: 'Stock opname not found'
        })
      }

      if (opname.status === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete completed stock opname'
        })
      }

      await db.stockOpnameItem.destroy({
        where: { stockOpname: id }
      })

      await opname.destroy()

      return res.status(200).json({
        success: true,
        message: 'Success delete stock opname'
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

module.exports = stockOpnameController