const db = require('../../db/models')
const { Op } = require('sequelize')
const { isSuperAdmin, scalarStoreScope } = require('../../utils/tenantScope')

// HIGH-1: The original implementation read `req.cookies?.store || req.user?.store`
// as the effective tenant. The cookie is a client-controlled value that
// validateStoreAccess never inspects, so a store-A user could set
// Cookie: store=6 and read store 6's sales reports.
//
// Authority order (guaranteed server-side, never client-supplied):
//   req.storeId  — pinned by validateStoreAccess from the JWT store claim;
//                  super_admin: explicitly-requested store or null.
//   req.user?.store — JWT claim fallback for any middleware gap.
// The query/cookie store hint from the client is IGNORED for authorization.
// For super_admin: an explicit ?store is honoured (same as before) because
// that is intentional global-access behaviour; no store → sees all rows.
const effectiveTenantStore = (req) => {
  // req.storeId is set by validateStoreAccess:
  //   - non-super: always the caller's JWT store (null → would have been 403'd)
  //   - super_admin: the explicit ?store value, or null for global access
  // Fall back to req.user?.store to tolerate routes missing the middleware.
  return req.storeId ?? req.user?.store ?? null
}

const reportingController = {
  async getSalesSummary(req, res) {
    try {
      const { startDate, endDate, page = 1, limit = 30 } = req.query
      // HIGH-1 fix: ignore req.query.store and req.cookies.store for
      // authorization; derive the tenant from the pinned server-side context.
      const tenantStore = effectiveTenantStore(req)

      if (!tenantStore && !isSuperAdmin(req)) {
        return res
          .status(403)
          .json({ success: false, message: 'Store assignment required' })
      }

      // scalarStoreScope: super_admin without store → unrestricted;
      // tenant → always WHERE store = <tenantStore>.
      const where = scalarStoreScope(req, {})
      // Override with the effective store if scalarStoreScope didn't add one
      // (handles case where req.user.store differs from req.storeId edge):
      if (tenantStore && !isSuperAdmin(req)) where.store = tenantStore

      if (startDate || endDate) {
        where.report_date = {}
        if (startDate) where.report_date[Op.gte] = new Date(startDate)
        if (endDate) where.report_date[Op.lte] = new Date(endDate)
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)
      const { count, rows } = await db.sales_summary.findAndCountAll({
        where,
        include: [
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
        ],
        order: [['report_date', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      return res.status(200).json({
        success: true,
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  },

  async getProductSalesSummary(req, res) {
    try {
      const { startDate, endDate, page = 1, limit = 50 } = req.query
      // HIGH-1 fix: tenant from pinned server-side context only.
      const tenantStore = effectiveTenantStore(req)

      // MEDIUM fix: unassigned non-super-admin MUST fail closed, not leak all
      // stores' product sales data with an empty WHERE clause.
      if (!tenantStore && !isSuperAdmin(req)) {
        return res
          .status(403)
          .json({ success: false, message: 'Store assignment required' })
      }

      const where = tenantStore ? { store: tenantStore } : {}
      if (startDate || endDate) {
        where.report_date = {}
        if (startDate) where.report_date[Op.gte] = new Date(startDate)
        if (endDate) where.report_date[Op.lte] = new Date(endDate)
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)
      const { count, rows } = await db.product_sales_summary.findAndCountAll({
        where,
        include: [
          {
            model: db.product,
            as: 'productData',
            attributes: ['id', 'nameProduct']
          },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
        ],
        order: [
          ['revenue', 'DESC'],
          ['report_date', 'DESC']
        ],
        limit: parseInt(limit),
        offset
      })

      return res.status(200).json({
        success: true,
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  },

  async getCategorySalesSummary(req, res) {
    try {
      const { startDate, endDate, page = 1, limit = 20 } = req.query
      // HIGH-1 fix: tenant from pinned server-side context only.
      const tenantStore = effectiveTenantStore(req)

      const where = tenantStore ? { store: tenantStore } : {}
      // MEDIUM fix: fail closed for unassigned non-super-admin.
      if (!tenantStore && !isSuperAdmin(req)) {
        return res
          .status(403)
          .json({ success: false, message: 'Store assignment required' })
      }

      if (startDate || endDate) {
        where.report_date = {}
        if (startDate) where.report_date[Op.gte] = new Date(startDate)
        if (endDate) where.report_date[Op.lte] = new Date(endDate)
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)
      const { count, rows } = await db.category_sales_summary.findAndCountAll({
        where,
        include: [
          {
            model: db.category,
            as: 'categoryData',
            attributes: ['id', 'name']
          },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
        ],
        order: [
          ['revenue', 'DESC'],
          ['report_date', 'DESC']
        ],
        limit: parseInt(limit),
        offset
      })

      return res.status(200).json({
        success: true,
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  },

  async getKasirPerformance(req, res) {
    try {
      const { startDate, endDate, page = 1, limit = 30 } = req.query
      // HIGH-1 fix: tenant from pinned server-side context only.
      const tenantStore = effectiveTenantStore(req)

      const where = tenantStore ? { store: tenantStore } : {}
      // MEDIUM fix: fail closed for unassigned non-super-admin.
      if (!tenantStore && !isSuperAdmin(req)) {
        return res
          .status(403)
          .json({ success: false, message: 'Store assignment required' })
      }

      if (startDate || endDate) {
        where.report_date = {}
        if (startDate) where.report_date[Op.gte] = new Date(startDate)
        if (endDate) where.report_date[Op.lte] = new Date(endDate)
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)
      const { count, rows } = await db.kasir_performance.findAndCountAll({
        where,
        include: [
          {
            model: db.user,
            as: 'cashierData',
            attributes: ['id', 'fullName', 'userName']
          },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
        ],
        order: [
          ['total_sales', 'DESC'],
          ['report_date', 'DESC']
        ],
        limit: parseInt(limit),
        offset
      })

      return res.status(200).json({
        success: true,
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  }
}

module.exports = reportingController
