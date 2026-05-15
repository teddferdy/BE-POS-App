const db = require('../../db/models')
const { Op } = require('sequelize')

const generateOrderNumber = (prefix) => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')
  return `${prefix}-${year}${month}${day}-${random}`
}

const supplierController = {
  async getAll(req, res) {
    try {
      const { store } = req.cookies
      const { search, status } = req.query

      const where = { store }
      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { phone: { [Op.iLike]: `%${search}%` } }
        ]
      }
      if (status !== undefined) {
        where.status = status === 'true'
      }

      const suppliers = await db.supplier.findAll({
        where,
        order: [['createdAt', 'DESC']]
      })

      return res.status(200).json({
        success: true,
        message: 'Success get suppliers',
        data: suppliers
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

      const supplier = await db.supplier.findOne({
        where: { id, store }
      })

      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: 'Supplier not found'
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Success get supplier',
        data: supplier
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
      const { name, phone, email, address, description } = req.body
      const createdBy = req.user?.id || null

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Name is required'
        })
      }

      const supplier = await db.supplier.create({
        store,
        name,
        phone,
        email,
        address,
        description,
        createdBy
      })

      return res.status(201).json({
        success: true,
        message: 'Success create supplier',
        data: supplier
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
      const { name, phone, email, address, description, status } = req.body
      const modifiedBy = req.user?.id || null

      const supplier = await db.supplier.findOne({
        where: { id, store }
      })

      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: 'Supplier not found'
        })
      }

      await supplier.update({
        name: name || supplier.name,
        phone: phone !== undefined ? phone : supplier.phone,
        email: email !== undefined ? email : supplier.email,
        address: address !== undefined ? address : supplier.address,
        description: description !== undefined ? description : supplier.description,
        status: status !== undefined ? status : supplier.status,
        modifiedBy
      })

      return res.status(200).json({
        success: true,
        message: 'Success update supplier',
        data: supplier
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

      const supplier = await db.supplier.findOne({
        where: { id, store }
      })

      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: 'Supplier not found'
        })
      }

      await supplier.destroy()

      return res.status(200).json({
        success: true,
        message: 'Success delete supplier'
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

module.exports = supplierController