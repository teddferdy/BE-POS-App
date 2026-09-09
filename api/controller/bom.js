const db = require('../../db/models')
const { Op } = require('sequelize')
const { enrichAuditFields } = require('../../utils/auditFields')

const bomController = {
  async getAll(req, res) {
    try {
      const { page = 1, limit = 20, search, status } = req.query
      const store = req.storeId
      const offset = (parseInt(page) - 1) * parseInt(limit)

      const where = { ...(store ? { store } : {}) }
      if (status && status !== 'all') where.status = status
      if (search)
        where['$productData.nameProduct$'] = { [Op.iLike]: `%${search}%` }

      const { count, rows } = await db.bom_header.findAndCountAll({
        where,
        include: [
          {
            model: db.product,
            as: 'productData',
            attributes: ['id', 'nameProduct', 'sku']
          },
          {
            model: db.bom_line,
            as: 'lines',
            include: [
              {
                model: db.ingredient,
                as: 'ingredientData',
                attributes: ['id', 'name', 'unit']
              }
            ]
          }
        ],
        order: [['updatedAt', 'DESC']],
        limit: parseInt(limit),
        offset
      })
      await enrichAuditFields(db, rows)

      return res.status(200).json({
        success: true,
        message: 'Success',
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      })
    } catch (error) {
      console.error('Error =>', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params
      const store = req.storeId
      const where = { id }
      if (store) where.store = store
      const bom = await db.bom_header.findOne({
        where,
        include: [
          {
            model: db.product,
            as: 'productData',
            attributes: ['id', 'nameProduct', 'sku', 'composition']
          },
          {
            model: db.bom_line,
            as: 'lines',
            include: [
              {
                model: db.ingredient,
                as: 'ingredientData',
                attributes: ['id', 'name', 'unit']
              }
            ]
          }
        ]
      })

      if (!bom)
        return res
          .status(404)
          .json({ success: false, message: 'BOM not found' })
      return res
        .status(200)
        .json({ success: true, message: 'Success', data: bom })
    } catch (error) {
      console.error('Error =>', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async create(req, res) {
    try {
      // MEDIUM fix: removed req.cookies.store — cookie is client-controlled.
      // Use server-pinned req.storeId (validateStoreAccess JWT store) with
      // req.user?.store as a fallback for routes missing middleware.
      const store = req.storeId ?? req.user?.store
      const { productId, name, notes, lines } = req.body
      if (!productId || !lines?.length) {
        return res
          .status(400)
          .json({ success: false, message: 'productId and lines are required' })
      }

      const existing = await db.bom_header.findOne({
        where: { productId, store }
      })
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'BOM already exists for this product'
        })
      }

      const bomLines = lines.map((l) => ({
        ingredientId: l.ingredientId,
        qty: l.qty || 0,
        unit: l.unit || 'pcs',
        notes: l.notes
      }))

      // F7: BASE-UNIT-ONLY contract — a BOM line's unit must match its
      // ingredient's baseUnit at authoring time (deduction time
      // independently re-verifies this against live data; this check
      // exists so misconfiguration is caught immediately rather than
      // only discovered at the next sale).
      const authoringIngIds = [...new Set(bomLines.map((l) => l.ingredientId))]
      const authoringIngs = await db.ingredient.findAll({
        where: { id: authoringIngIds }
      })
      const authoringIngById = new Map(authoringIngs.map((i) => [i.id, i]))
      for (const line of bomLines) {
        const ing = authoringIngById.get(line.ingredientId)
        if (!ing) {
          return res.status(400).json({
            success: false,
            message: `Ingredient ${line.ingredientId} not found`
          })
        }
        if (line.unit !== ing.baseUnit) {
          return res.status(400).json({
            success: false,
            message: `Unit mismatch for ingredient "${ing.name}": BOM line uses "${line.unit}", ingredient base unit is "${ing.baseUnit}"`
          })
        }
      }

      const bom = await db.bom_header.create({
        store,
        productId,
        name: name || `BOM-${Date.now()}`,
        notes,
        status: req.body.status || 'active'
      })

      await db.bom_line.bulkCreate(
        bomLines.map((l) => ({ ...l, bomHeaderId: bom.id }))
      )

      // ——— Auto-calculate HPP ———
      const ings = authoringIngs
      const costMap = Object.fromEntries(
        ings.map((i) => [i.id, Number(i.costPrice || 0)])
      )
      const hpp = bomLines.reduce(
        (sum, l) => sum + (costMap[l.ingredientId] || 0) * l.qty,
        0
      )
      const prod = await db.product.findByPk(productId)
      if (prod) {
        const price = Number(prod.price || 0)
        const foodCostPersen =
          hpp > 0 && price > 0
            ? Math.min(999.99, parseFloat(((hpp / price) * 100).toFixed(2)))
            : 0
        const marginPersen =
          hpp > 0 && price > 0
            ? Math.max(0, parseFloat(((1 - hpp / price) * 100).toFixed(2)))
            : 0
        const composition = bomLines.map((l) => {
          const ing = ings.find((i) => i.id === l.ingredientId)
          return {
            ingredientId: l.ingredientId,
            name: ing?.name || 'Unknown',
            qty: l.qty,
            unit: ing?.unit || l.unit || 'pcs'
          }
        })
        await prod.update({
          hppPerPorsi: hpp,
          foodCostPersen,
          marginPersen,
          composition
        })
      }

      const result = await db.bom_header.findByPk(bom.id, {
        include: [
          { model: db.product, as: 'productData' },
          { model: db.bom_line, as: 'lines' }
        ]
      })

      return res
        .status(201)
        .json({ success: true, message: 'BOM created', data: result })
    } catch (error) {
      console.error('Error =>', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params
      const { name, notes, lines, status } = req.body
      const store = req.storeId

      const where = { id }
      if (store) where.store = store
      const bom = await db.bom_header.findOne({ where })
      if (!bom)
        return res
          .status(404)
          .json({ success: false, message: 'BOM not found' })

      const updateData = { name, notes }
      if (status) updateData.status = status
      await bom.update(updateData)

      if (lines) {
        const bomLines = lines.map((l) => ({
          ingredientId: l.ingredientId,
          qty: l.qty || 0,
          unit: l.unit || 'pcs',
          notes: l.notes
        }))

        // F7: BASE-UNIT-ONLY contract, validated before touching any
        // existing bom_line row — a rejected update must leave the
        // previous, still-valid BOM untouched.
        const authoringIngIds = [...new Set(bomLines.map((l) => l.ingredientId))]
        const authoringIngs = await db.ingredient.findAll({
          where: { id: authoringIngIds }
        })
        const authoringIngById = new Map(authoringIngs.map((i) => [i.id, i]))
        for (const line of bomLines) {
          const ing = authoringIngById.get(line.ingredientId)
          if (!ing) {
            return res.status(400).json({
              success: false,
              message: `Ingredient ${line.ingredientId} not found`
            })
          }
          if (line.unit !== ing.baseUnit) {
            return res.status(400).json({
              success: false,
              message: `Unit mismatch for ingredient "${ing.name}": BOM line uses "${line.unit}", ingredient base unit is "${ing.baseUnit}"`
            })
          }
        }

        await db.bom_line.destroy({ where: { bomHeaderId: id } })
        await db.bom_line.bulkCreate(
          bomLines.map((l) => ({ ...l, bomHeaderId: id }))
        )
      }

      // ——— Recalculate HPP ———
      const currentLines = await db.bom_line.findAll({
        where: { bomHeaderId: id }
      })
      if (currentLines.length > 0) {
        const ingIds = [...new Set(currentLines.map((l) => l.ingredientId))]
        const ings = await db.ingredient.findAll({ where: { id: ingIds } })
        const costMap = Object.fromEntries(
          ings.map((i) => [i.id, Number(i.costPrice || 0)])
        )
        const hpp = currentLines.reduce(
          (sum, l) => sum + (costMap[l.ingredientId] || 0) * l.qty,
          0
        )
        const prod = await db.product.findByPk(bom.productId)
        if (prod) {
          const price = Number(prod.price || 0)
          const foodCostPersen =
            hpp > 0 && price > 0
              ? Math.min(999.99, parseFloat(((hpp / price) * 100).toFixed(2)))
              : 0
          const marginPersen =
            hpp > 0 && price > 0
              ? Math.max(0, parseFloat(((1 - hpp / price) * 100).toFixed(2)))
              : 0
          const composition = currentLines.map((l) => {
            const ing = ings.find((i) => i.id === l.ingredientId)
            return {
              ingredientId: l.ingredientId,
              name: ing?.name || 'Unknown',
              qty: l.qty,
              unit: ing?.unit || l.unit || 'pcs'
            }
          })
          await prod.update({
            hppPerPorsi: hpp,
            foodCostPersen,
            marginPersen,
            composition
          })
        }
      }

      const result = await db.bom_header.findByPk(id, {
        include: [
          { model: db.product, as: 'productData' },
          { model: db.bom_line, as: 'lines' }
        ]
      })

      return res
        .status(200)
        .json({ success: true, message: 'BOM updated', data: result })
    } catch (error) {
      console.error('Error =>', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params
      const store = req.storeId
      const where = { id }
      if (store) where.store = store
      const bom = await db.bom_header.findOne({ where })
      if (!bom)
        return res
          .status(404)
          .json({ success: false, message: 'BOM not found' })

      await db.bom_line.destroy({ where: { bomHeaderId: id } })
      await bom.destroy()

      // ——— Reset product composition ———
      const prod = await db.product.findByPk(bom.productId)
      if (prod) {
        await prod.update({
          hppPerPorsi: 0,
          foodCostPersen: 0,
          marginPersen: 0,
          composition: []
        })
      }

      return res.status(200).json({ success: true, message: 'BOM deleted' })
    } catch (error) {
      console.error('Error =>', error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  }
}

module.exports = bomController
