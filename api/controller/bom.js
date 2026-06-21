const db = require('../../db/models')
const { Op } = require('sequelize')

const bomController = {
  async getAll(req, res) {
    try {
      const { page = 1, limit = 20, search, status } = req.query
      const store = req.cookies.store || req.user?.store
      const offset = (parseInt(page) - 1) * parseInt(limit)

      const where = { ...(store ? { store } : {}) }
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
                model: db.product,
                as: 'ingredientData',
                attributes: ['id', 'nameProduct', 'sku']
              }
            ]
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset
      })

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
      const bom = await db.bom_header.findOne({
        where: { id },
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
                model: db.product,
                as: 'ingredientData',
                attributes: ['id', 'nameProduct', 'sku', 'sellingPrice']
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
      const store = req.cookies.store || req.user?.store
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

      const bom = await db.bom_header.create({
        store,
        productId,
        name: name || `BOM-${Date.now()}`,
        notes,
        status: req.body.status || 'active',
        createdBy: req.body.createdBy || req.user?.id
      })

      const bomLines = lines.map((l) => ({
        bomHeaderId: bom.id,
        ingredientId: l.ingredientId,
        qty: l.qty || 0,
        unit: l.unit || 'pcs',
        notes: l.notes
      }))
      await db.bom_line.bulkCreate(bomLines)

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

      const bom = await db.bom_header.findByPk(id)
      if (!bom)
        return res
          .status(404)
          .json({ success: false, message: 'BOM not found' })

      const updateData = { name, notes, modifiedBy: req.body.modifiedBy || req.user?.id }
      if (status) updateData.status = status
      await bom.update(updateData)

      if (lines) {
        await db.bom_line.destroy({ where: { bomHeaderId: id } })
        const bomLines = lines.map((l) => ({
          bomHeaderId: id,
          ingredientId: l.ingredientId,
          qty: l.qty || 0,
          unit: l.unit || 'pcs',
          notes: l.notes
        }))
        await db.bom_line.bulkCreate(bomLines)
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
      const bom = await db.bom_header.findByPk(id)
      if (!bom)
        return res
          .status(404)
          .json({ success: false, message: 'BOM not found' })

      await db.bom_line.destroy({ where: { bomHeaderId: id } })
      await bom.destroy()

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
