const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')

const ingredientController = {
    async getAll(req, res) {
    try {
      const store = req.cookies.store || req.user?.store
      const { search, status, lowStock } = req.query

      const where = store ? { store } : {}
      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } }
        ]
      }
      if (status !== undefined) {
        where.status = status === 'true' || status === 'active' ? 'active' : 'inactive'
      }

      let ingredients = await db.ingredient.findAll({
        where,
        include: [
          {
            model: db.supplier,
            as: 'supplierData',
            attributes: ['id', 'name']
          }
        ],
        order: [['name', 'ASC']]
      })

      if (lowStock === 'true') {
        ingredients = ingredients.filter(
          (ing) => ing.stock <= ing.minStock
        )
      }

      return res.status(200).json({
        success: true,
        message: 'Success get ingredients',
        data: ingredients
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
      const store = req.cookies.store || req.user?.store

      const ingredient = await db.ingredient.findOne({
        where: { id, ...(store ? { store } : {}) },
        include: [
          {
            model: db.supplier,
            as: 'supplierData',
            attributes: ['id', 'name', 'phone']
          }
        ]
      })

      if (!ingredient) {
        return res.status(404).json({
          success: false,
          message: 'Ingredient not found'
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success get ingredient',
        data: ingredient
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
      const store = req.cookies.store || req.user?.store
      const { name, category, supplier, stock = 0, minStock = 0, unit, costPrice, status } = req.body
      const createdBy = req.user?.id || null

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Name is required'
        })
      }

      const ingredient = await db.ingredient.create({
        store,
        name,
        category,
        supplier,
        stock,
        minStock,
        unit: unit || 'pcs',
        costPrice: costPrice || 0,
        status: status !== undefined ? (status === true ? 'active' : status === false ? 'inactive' : status) : 'active',
        createdBy
      })
      createAudit(req, 'create', 'ingredient', ingredient.id, 'Created ingredient: ' + (ingredient.name || ingredient.id))

      return res.status(201).json({
        success: true,
        message: 'Success create ingredient',
        data: ingredient
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
      const store = req.cookies.store || req.user?.store
      const { name, category, supplier, stock, minStock, unit, costPrice, status } = req.body
      const modifiedBy = req.user?.id || null

      const ingredient = await db.ingredient.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!ingredient) {
        return res.status(404).json({
          success: false,
          message: 'Ingredient not found'
        })
      }

      const oldStock = ingredient.stock

      await ingredient.update({
        name: name || ingredient.name,
        category: category !== undefined ? category : ingredient.category,
        supplier: supplier !== undefined ? supplier : ingredient.supplier,
        stock: stock !== undefined ? stock : ingredient.stock,
        minStock: minStock !== undefined ? minStock : ingredient.minStock,
        unit: unit || ingredient.unit,
        costPrice: costPrice !== undefined ? costPrice : ingredient.costPrice,
        status: status !== undefined ? (status === true ? 'active' : status === false ? 'inactive' : status) : ingredient.status,
        modifiedBy
      })
      createAudit(req, 'update', 'ingredient', id, 'Updated ingredient: ' + id)

      if (stock !== undefined && stock !== oldStock) {
        const quantityBefore = oldStock
        const quantityChange = stock - oldStock

        await db.stockHistory.create({
          store,
          ingredientName: ingredient.name,
          referenceType: 'adjustment',
          referenceId: id,
          quantityBefore,
          quantityChange,
          quantityAfter: stock,
          unit: ingredient.unit,
          createdBy: req.user?.id
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success update ingredient',
        data: ingredient
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

    async adjustStock(req, res) {
    try {
      const { id } = req.params
      const store = req.cookies.store || req.user?.store
      const { quantity, type, notes } = req.body

      const ingredient = await db.ingredient.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!ingredient) {
        return res.status(404).json({
          success: false,
          message: 'Ingredient not found'
        })
      }

      const quantityBefore = ingredient.stock
      let quantityChange = quantity

      if (type === 'add') {
        quantityChange = quantity
      } else if (type === 'subtract') {
        quantityChange = -quantity
        if (ingredient.stock < quantity) {
          return res.status(400).json({
            success: false,
            message: 'Insufficient stock'
          })
        }
      } else if (type === 'set') {
        quantityChange = quantity - ingredient.stock
      }

      const quantityAfter = quantityBefore + quantityChange

      await db.stockHistory.create({
        store,
        ingredientName: ingredient.name,
        referenceType: 'adjustment',
        referenceId: id,
        quantityBefore,
        quantityChange,
        quantityAfter,
        unit: ingredient.unit,
        notes,
        createdBy: req.user?.id
      })

      await ingredient.update({ stock: quantityAfter })

      return res.status(200).json({
        success: true,
        message: 'Success adjust stock',
        data: {
          ingredient,
          quantityBefore,
          quantityChange,
          quantityAfter
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

    async delete(req, res) {
    try {
      const { id } = req.params
      const store = req.cookies.store || req.user?.store

      const ingredient = await db.ingredient.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!ingredient) {
        return res.status(404).json({
          success: false,
          message: 'Ingredient not found'
        })
      }

      await ingredient.destroy()
      createAudit(req, 'delete', 'ingredient', id, 'Deleted ingredient: ' + id)

      return res.status(200).json({
        success: true,
        message: 'Success delete ingredient'
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

module.exports = ingredientController