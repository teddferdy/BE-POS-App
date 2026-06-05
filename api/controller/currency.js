const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')

const currencyController = {
  async getAll(req, res) {
    try {
      const store = req.cookies.store || req.user?.store
      const { page = 1, limit = 10, search, status } = req.query

      const where = {}
      if (store) where.store = store
      if (search) {
        where[Op.or] = [
          { code: { [Op.iLike]: `%${search}%` } },
          { name: { [Op.iLike]: `%${search}%` } }
        ]
      }
      if (status === 'active' || status === 'true') {
        where.status = 'active'
      } else if (status === 'inactive' || status === 'false') {
        where.status = 'inactive'
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const { count, rows } = await db.currency.findAndCountAll({
        where,
        order: [['isDefault', 'DESC'], ['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      return res.status(200).json({
        success: true,
        message: 'Success get currencies',
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
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params
      const store = req.cookies.store || req.user?.store

      const currency = await db.currency.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!currency) {
        return res.status(404).json({ success: false, message: 'Currency not found' })
      }

      return res.status(200).json({
        success: true,
        message: 'Success get currency',
        data: currency
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },

  async create(req, res) {
    try {
      const store = req.cookies.store || req.user?.store
      const { code, name, symbol, exchangeRate, isDefault, status } = req.body

      if (!code || !name || !symbol) {
        return res.status(400).json({ success: false, message: 'Code, name and symbol are required' })
      }

      const existing = await db.currency.findOne({
        where: { code: code.toUpperCase(), ...(store ? { store } : {}) }
      })
      if (existing) {
        return res.status(400).json({ success: false, message: 'Currency code already exists' })
      }

      if (isDefault) {
        await db.currency.update({ isDefault: false }, { where: store ? { store } : {} })
      }

      const currency = await db.currency.create({
        store,
        code: code.toUpperCase(),
        name,
        symbol,
        exchangeRate: exchangeRate || 1,
        isDefault: isDefault || false,
        status: status !== undefined ? (status === true ? 'active' : status === false ? 'inactive' : status) : 'active',
        createdBy: req.user?.id
      })

      createAudit(req, 'create', 'currency', currency.id, `Created currency ${code} - ${name}`)

      return res.status(201).json({
        success: true,
        message: 'Success create currency',
        data: currency
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params
      const store = req.cookies.store || req.user?.store
      const { code, name, symbol, exchangeRate, isDefault, status } = req.body

      const currency = await db.currency.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!currency) {
        return res.status(404).json({ success: false, message: 'Currency not found' })
      }

      const oldValues = { ...currency.get() }

      if (isDefault) {
        await db.currency.update({ isDefault: false }, { where: store ? { store } : {} })
      }

      await currency.update({
        code: code?.toUpperCase() || currency.code,
        name: name || currency.name,
        symbol: symbol || currency.symbol,
        exchangeRate: exchangeRate !== undefined ? exchangeRate : currency.exchangeRate,
        isDefault: isDefault !== undefined ? isDefault : currency.isDefault,
        status: status !== undefined ? (status === true ? 'active' : status === false ? 'inactive' : status) : currency.status,
        modifiedBy: req.user?.id
      })

      createAudit(req, 'update', 'currency', id,
        `Updated currency ${currency.code}`,
        oldValues, { ...currency.get() }
      )

      return res.status(200).json({
        success: true,
        message: 'Success update currency',
        data: currency
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params
      const store = req.cookies.store || req.user?.store

      const currency = await db.currency.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!currency) {
        return res.status(404).json({ success: false, message: 'Currency not found' })
      }

      if (currency.isDefault) {
        return res.status(400).json({ success: false, message: 'Cannot delete default currency' })
      }

      await currency.destroy()

      createAudit(req, 'delete', 'currency', id, `Deleted currency ${currency.code}`)

      return res.status(200).json({ success: true, message: 'Success delete currency' })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },

  async setDefault(req, res) {
    try {
      const { id } = req.params
      const store = req.cookies.store || req.user?.store

      const currency = await db.currency.findOne({
        where: { id, ...(store ? { store } : {}) }
      })

      if (!currency) {
        return res.status(404).json({ success: false, message: 'Currency not found' })
      }

      await db.currency.update({ isDefault: false }, { where: store ? { store } : {} })

      await currency.update({ isDefault: true, modifiedBy: req.user?.id })

      createAudit(req, 'update', 'currency', id, `Set ${currency.code} as default currency`)

      return res.status(200).json({
        success: true,
        message: `Success set ${currency.code} as default currency`,
        data: currency
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
}

module.exports = currencyController
