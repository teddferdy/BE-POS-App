const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')
const { enrichAuditFields } = require('../../utils/auditFields')

module.exports = {
  async getAll(req, res) {
    try {
      const { search, status, page = 1, limit = 50 } = req.query
      const where = {}

      if (search) {
        where.name = { [Op.iLike]: `%${String(search).trim()}%` }
      }
      if (status !== undefined) {
        where.status = status === true || status === 'true' ? 'active' : 'inactive'
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)
      const [data, total] = await Promise.all([
        db.supplier_category.findAll({
          where,
          order: [['name', 'ASC']],
          limit: parseInt(limit),
          offset
        }),
        db.supplier_category.count({ where })
      ])

      await enrichAuditFields(db, data)

      return res.status(200).json({
        success: true,
        message: 'Success get supplier categories',
        data,
        stats: { total }
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params
      const category = await db.supplier_category.findByPk(id)
      if (!category) {
        return res.status(404).json({ success: false, message: 'Supplier category not found' })
      }

      // ponytail: sertakan supplier yang termasuk kategori ini
      const suppliers = await db.supplier.findAll({
        where: { categoryId: id },
        attributes: ['id', 'name', 'status', 'phone', 'email', 'contactPerson'],
        order: [['name', 'ASC']]
      })

      await enrichAuditFields(db, [category])

      return res.status(200).json({
        success: true,
        message: 'Success get supplier category',
        data: {
          ...category.toJSON(),
          suppliers,
          supplierCount: suppliers.length
        }
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },

  async create(req, res) {
    try {
      const { name, description, status } = req.body
      const trimmedName = String(name || '').trim()
      if (!trimmedName) {
        return res.status(400).json({ success: false, message: 'Category name is required' })
      }

      const existing = await db.supplier_category.findOne({
        where: { name: { [Op.iLike]: trimmedName } },
        paranoid: false
      })
      if (existing) {
        return res.status(409).json({ success: false, message: 'Category name already exists' })
      }

      const category = await db.supplier_category.create({
        name: trimmedName,
        description: description?.trim() || null,
        status: status || 'active'
      })

      createAudit(req, 'create', 'supplier_category', category.id, `Created supplier category: ${trimmedName}`)

      return res.status(201).json({ success: true, message: 'Success create supplier category', data: category })
    } catch (error) {
      console.log(error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params
      const { name, description, status } = req.body

      const category = await db.supplier_category.findByPk(id)
      if (!category) {
        return res.status(404).json({ success: false, message: 'Supplier category not found' })
      }

      const trimmedName = name?.trim()
      if (trimmedName) {
        const existing = await db.supplier_category.findOne({
          where: { id: { [Op.ne]: id }, name: { [Op.iLike]: trimmedName } },
          paranoid: false
        })
        if (existing) {
          return res.status(409).json({ success: false, message: 'Category name already exists' })
        }
      }

      await category.update({
        name: trimmedName ?? category.name,
        description: description !== undefined ? description?.trim() || null : category.description,
        status: status !== undefined ? status : category.status
      })

      createAudit(req, 'update', 'supplier_category', id, `Updated supplier category: ${id}`)

      return res.status(200).json({ success: true, message: 'Success update supplier category', data: category })
    } catch (error) {
      console.log(error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params
      const category = await db.supplier_category.findByPk(id)
      if (!category) {
        return res.status(404).json({ success: false, message: 'Supplier category not found' })
      }

      const supplierCount = await db.supplier.count({ where: { categoryId: id } })
      if (supplierCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete category: ${supplierCount} supplier(s) still assigned to this category`
        })
      }

      await category.destroy()
      createAudit(req, 'delete', 'supplier_category', id, `Deleted supplier category: ${id}`)

      return res.status(200).json({ success: true, message: 'Success delete supplier category' })
    } catch (error) {
      console.log(error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
}
