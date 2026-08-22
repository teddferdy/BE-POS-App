const db = require('../../db/models')
const { Op } = require('sequelize')

const auditLogController = {
  async getAll(req, res) {
    try {
      const store = req.storeId || req.cookies.store || req.user?.store
      const {
        page = 1,
        limit = 20,
        entity,
        action,
        userId,
        startDate,
        endDate
      } = req.query

      const where = {}
      if (store) where.store = store
      if (entity) where.entity = entity
      if (action) where.action = action
      if (userId) where.userId = parseInt(userId)
      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt[Op.gte] = new Date(startDate)
        if (endDate) where.createdAt[Op.lte] = new Date(endDate + 'T23:59:59')
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const { count, rows } = await db.auditLog.findAndCountAll({
        where,
        order: [['updatedAt', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      return res.status(200).json({
        success: true,
        message: 'Success get audit logs',
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

  async getByEntity(req, res) {
    try {
      const { entity, entityId } = req.params
      const store = req.storeId || req.cookies.store || req.user?.store
      const { page = 1, limit = 10 } = req.query

      const where = {
        entity,
        entityId: parseInt(entityId),
        ...(store ? { store } : {})
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const { count, rows } = await db.auditLog.findAndCountAll({
        where,
        order: [['updatedAt', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      return res.status(200).json({
        success: true,
        message: 'Success get audit logs',
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
  }
}

module.exports = auditLogController
