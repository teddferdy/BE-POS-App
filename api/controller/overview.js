const db = require('../../db/models')
const { Op } = require('sequelize')

let _productStoreExists = null
let _categoryStoreExists = null
const hasTable = async (tableName) => {
  if (tableName === 'product_store') {
    if (_productStoreExists !== null) return _productStoreExists
  } else if (tableName === 'category_store') {
    if (_categoryStoreExists !== null) return _categoryStoreExists
  }
  try {
    await db.sequelize.query(`SELECT 1 FROM ${tableName} LIMIT 1`)
    if (tableName === 'product_store') _productStoreExists = true
    if (tableName === 'category_store') _categoryStoreExists = true
    return true
  } catch {
    if (tableName === 'product_store') _productStoreExists = false
    if (tableName === 'category_store') _categoryStoreExists = false
    return false
  }
}

const overviewController = {
  async getProductSummary(req, res) {
    try {
      // req.storeId is the value validateStoreAccess already verified
      // (the caller's own store for every role except super_admin, who
      // gets exactly what they asked for or null for "all stores").
      // Reading store straight from req.query here instead meant this
      // endpoint had a route-level access check that the controller body
      // never actually used — any authenticated role could simply omit
      // ?store= and get platform-wide counts across every tenant instead
      // of being confined to their own store.
      const store = req.storeId
      let sql
      const replacements = {}

      if (store) {
        const storeId = Number(store)
        if (await hasTable('product_store')) {
          sql = `SELECT COUNT(*) as total,
                  COUNT(*) FILTER (WHERE "status" = 'active') as active,
                  COUNT(*) FILTER (WHERE "status" = 'inactive') as inactive
           FROM "product"
           WHERE ("product"."deletedAt" IS NULL)
             AND (
               EXISTS (SELECT 1 FROM product_store WHERE product = "product".id AND store = :store AND "deletedAt" IS NULL)
               OR NOT EXISTS (SELECT 1 FROM product_store WHERE product = "product".id AND "deletedAt" IS NULL)
             )`
          replacements.store = storeId
        } else {
          sql = `SELECT COUNT(*) as total,
                  COUNT(*) FILTER (WHERE "status" = 'active') as active,
                  COUNT(*) FILTER (WHERE "status" = 'inactive') as inactive
           FROM "product"
           WHERE ("product"."deletedAt" IS NULL)`
        }
      } else {
        sql = `SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE "status" = 'active') as active,
                COUNT(*) FILTER (WHERE "status" = 'inactive') as inactive
         FROM "product"
         WHERE ("product"."deletedAt" IS NULL)`
      }

      const [result] = await db.sequelize.query(sql, {
        replacements,
        type: db.sequelize.QueryTypes.SELECT
      })

      return res.status(200).json({
        success: true,
        message: 'Success get product summary',
        data: {
          total: Number(result.total),
          active: Number(result.active),
          inactive: Number(result.inactive)
        }
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getCategorySummary(req, res) {
    try {
      // See getProductSummary above for why this is req.storeId, not
      // req.query.store.
      const store = req.storeId
      let sql
      const replacements = {}

      if (store) {
        const storeId = Number(store)
        if (await hasTable('category_store')) {
          sql = `SELECT COUNT(*) as total,
                  COUNT(*) FILTER (WHERE "status" = 'active') as active,
                  COUNT(*) FILTER (WHERE "status" = 'inactive') as inactive
           FROM "category"
           WHERE ("category"."deletedAt" IS NULL)
             AND (
               EXISTS (SELECT 1 FROM category_store WHERE category = "category".id AND store = :store AND "deletedAt" IS NULL)
               OR NOT EXISTS (SELECT 1 FROM category_store WHERE category = "category".id AND "deletedAt" IS NULL)
             )`
          replacements.store = storeId
        } else {
          sql = `SELECT COUNT(*) as total,
                  COUNT(*) FILTER (WHERE "status" = 'active') as active,
                  COUNT(*) FILTER (WHERE "status" = 'inactive') as inactive
           FROM "category"
           WHERE ("category"."deletedAt" IS NULL)`
        }
      } else {
        sql = `SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE "status" = 'active') as active,
                COUNT(*) FILTER (WHERE "status" = 'inactive') as inactive
         FROM "category"
         WHERE ("category"."deletedAt" IS NULL)`
      }

      const [result] = await db.sequelize.query(sql, {
        replacements,
        type: db.sequelize.QueryTypes.SELECT
      })

      return res.status(200).json({
        success: true,
        message: 'Success get category summary',
        data: {
          total: Number(result.total),
          active: Number(result.active),
          inactive: Number(result.inactive)
        }
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getLocationSummary(req, res) {
    try {
      // Previously unscoped entirely — any admin/kasir hitting this
      // endpoint got the active/inactive location count across the WHOLE
      // deployment, not just their own store. req.storeId is a
      // location.id (the "store" this codebase's user/order/etc. records
      // scope by is the branch, i.e. location.id), so scope to that row.
      const store = req.storeId
      const [result] = await db.sequelize.query(
        `SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE "status" = 'active') as active,
                COUNT(*) FILTER (WHERE "status" = 'inactive') as inactive
         FROM "location"
         ${store ? 'WHERE "id" = :store' : ''}`,
        { replacements: store ? { store } : {}, type: db.sequelize.QueryTypes.SELECT }
      )

      return res.status(200).json({
        success: true,
        message: 'Success get location summary',
        data: {
          total: Number(result.total),
          active: Number(result.active),
          inactive: Number(result.inactive)
        }
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getMemberSummary(req, res) {
    try {
      // See getProductSummary above for why this is req.storeId, not
      // req.query.store.
      const store = req.storeId
      const replacements = {}
      let conditions = '1=1'
      if (store) {
        conditions += ` AND "store" = :store`
        replacements.store = store
      }

      const [result] = await db.sequelize.query(
        `SELECT COUNT(*) as total FROM "member" WHERE ${conditions}`,
        { replacements, type: db.sequelize.QueryTypes.SELECT }
      )

      return res.status(200).json({
        success: true,
        message: 'Success get member summary',
        data: { total: Number(result.total) }
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getUserSummary(req, res) {
    try {
      // Previously unscoped entirely — any admin/kasir got the staff
      // headcount across the whole deployment instead of their own store.
      const store = req.storeId
      const [result] = await db.sequelize.query(
        `SELECT COUNT(*) as total FROM "user" ${store ? 'WHERE "store" = :store' : ''}`,
        { replacements: store ? { store } : {}, type: db.sequelize.QueryTypes.SELECT }
      )

      return res.status(200).json({
        success: true,
        message: 'Success get user summary',
        data: { total: Number(result.total) }
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getBestSelling(req, res) {
    try {
      // See getProductSummary above for why this is req.storeId, not
      // req.query.store.
      const { limit = 5 } = req.query
      const store = req.storeId

      const where = store ? { store } : {}

      const bestSelling = await db.best_selling.findAll({
        where,
        order: [['totalSelling', 'DESC']],
        limit: parseInt(limit)
      })

      return res.status(200).json({
        success: true,
        message: 'Success get best selling',
        data: bestSelling
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getLatestMembers(req, res) {
    try {
      // See getProductSummary above for why this is req.storeId, not
      // req.query.store.
      const { limit = 5 } = req.query
      const store = req.storeId

      const members = await db.member.findAll({
        where: store ? { store } : {},
        order: [['updatedAt', 'DESC']],
        limit: parseInt(limit)
      })

      return res.status(200).json({
        success: true,
        message: 'Success get latest members',
        data: members
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getLatestCategories(req, res) {
    try {
      // See getProductSummary above for why this is req.storeId, not
      // req.query.store.
      const { limit = 5 } = req.query
      const store = req.storeId

      let where = {}
      if (store) {
        const storeId = Number(store)
        if (await hasTable('category_store')) {
          where = {
            [Op.or]: [
              db.sequelize.literal(
                `EXISTS (SELECT 1 FROM category_store WHERE category = "category".id AND store = ${storeId} AND "deletedAt" IS NULL)`
              ),
              db.sequelize.literal(
                `NOT EXISTS (SELECT 1 FROM category_store WHERE category = "category".id AND "deletedAt" IS NULL)`
              )
            ]
          }
        }
      }

      const categories = await db.category.findAll({
        where,
        order: [['updatedAt', 'DESC']],
        limit: parseInt(limit)
      })

      return res.status(200).json({
        success: true,
        message: 'Success get latest categories',
        data: categories
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getLatestLocations(req, res) {
    try {
      // Previously unscoped entirely — see getLocationSummary above for
      // why req.storeId (a location.id) is the right filter here.
      const limit = parseInt(req.query.limit) || 5
      const store = req.storeId

      const locations = await db.location.findAll({
        where: store ? { id: store } : {},
        order: [['updatedAt', 'DESC']],
        limit
      })

      return res.status(200).json({
        success: true,
        message: 'Success get latest locations',
        data: locations
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getLatestProducts(req, res) {
    try {
      // See getProductSummary above for why this is req.storeId, not
      // req.query.store.
      const { limit = 5 } = req.query
      const store = req.storeId

      let where = {}
      if (store) {
        const storeId = Number(store)
        if (await hasTable('product_store')) {
          where = {
            [Op.or]: [
              db.sequelize.literal(
                `EXISTS (SELECT 1 FROM product_store WHERE product = "product".id AND store = ${storeId} AND "deletedAt" IS NULL)`
              ),
              db.sequelize.literal(
                `NOT EXISTS (SELECT 1 FROM product_store WHERE product = "product".id AND "deletedAt" IS NULL)`
              )
            ]
          }
        }
      }

      const products = await db.product.findAll({
        where,
        order: [['updatedAt', 'DESC']],
        limit: parseInt(limit)
      })

      return res.status(200).json({
        success: true,
        message: 'Success get latest products',
        data: products
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

module.exports = overviewController
