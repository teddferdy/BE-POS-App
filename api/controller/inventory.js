const db = require('../../db/models')
const inventoryService = require('../service/inventoryService')
const reconcileService = require('../service/reconcileService')
const batchService = require('../service/batchService')

const getStoreId = (req) =>
  req.query.storeId || req.query.store || req.cookies?.store || null

const inventoryController = {
  async getForecasts(req, res) {
    try {
      const storeId = getStoreId(req)
      const where = {}
      if (storeId) where.store = storeId
      if (req.query.productId) where.product = parseInt(req.query.productId)

      const forecasts = await db.stock_forecast.findAll({
        where,
        include: [
          { model: db.product, as: 'productData', attributes: ['id', 'nameProduct', 'sku'] },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
        ],
        order: [
          ['days_until_stockout', 'ASC'],
          ['forecast_date', 'DESC']
        ],
        limit: parseInt(req.query.limit || 50)
      })

      return res.status(200).json({ success: true, data: forecasts })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  },

  async runForecast(req, res) {
    try {
      const storeId = getStoreId(req)
      const productId = req.query.productId ? parseInt(req.query.productId) : null

      if (productId) {
        const f = await inventoryService.buildForecast(productId, storeId)
        await inventoryService.saveForecast(f)
        return res.status(200).json({ success: true, data: f })
      }

      const products = await db.product.findAll({
        where: { status: 'active' },
        attributes: ['id', 'nameProduct', 'stock', 'minStock']
      })
      const results = []
      for (const p of products) {
        try {
          const f = await inventoryService.buildForecast(p.id, storeId)
          await inventoryService.saveForecast(f)
          results.push(f)
        } catch (e) {
          console.error(`Forecast error product ${p.id}:`, e.message)
        }
      }
      return res.status(200).json({ success: true, data: results, total: results.length })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  },

  async getDeadStock(req, res) {
    try {
      const storeId = getStoreId(req)
      if (!storeId) {
        return res.status(400).json({ success: false, message: 'storeId/store required' })
      }
      const threshold = parseInt(req.query.threshold || 60)
      const results = await inventoryService.detectDeadStock(storeId, threshold)
      return res.status(200).json({ success: true, data: results, total: results.length })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  },

  async getExpiringSoon(req, res) {
    try {
      const storeId = getStoreId(req)
      const withinDays = parseInt(req.query.days || 30)
      const results = await inventoryService.getExpiringBatches(storeId, withinDays)
      return res.status(200).json({ success: true, data: results, total: results.length })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  },

  async getValuation(req, res) {
    try {
      const { productId, method = 'FIFO' } = req.query
      if (!productId) {
        return res.status(400).json({ success: false, message: 'productId required' })
      }
      const storeId = getStoreId(req)
      const result = await inventoryService.calculateValuation(
        parseInt(productId),
        storeId,
        method
      )
      return res.status(200).json({ success: true, data: result })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  },

  async getSupplierPerformance(req, res) {
    try {
      const month = req.query.month || null
      const results = await inventoryService.aggregateSupplierPerformance(month)
      return res.status(200).json({ success: true, data: results, total: results.length })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  },

  async getBatches(req, res) {
    try {
      const storeId = getStoreId(req)
      const where = {}
      if (storeId) where.store = storeId
      if (req.query.productId) where.product = parseInt(req.query.productId)
      if (req.query.status) where.status = req.query.status

      const batches = await db.product_batch.findAll({
        where,
        include: [
          { model: db.product, as: 'productData', attributes: ['id', 'nameProduct'] },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] },
          { model: db.supplier, as: 'supplierData', attributes: ['id', 'name'] },
          { model: db.product_batch_stock, as: 'stocks' }
        ],
        order: [['expiryDate', 'ASC']]
      })
      return res.status(200).json({ success: true, data: batches, total: batches.length })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  },

  async getBatchById(req, res) {
    try {
      const { id } = req.params
      const batch = await db.product_batch.findByPk(id, {
        include: [
          { model: db.product, as: 'productData', attributes: ['id', 'nameProduct'] },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] },
          { model: db.supplier, as: 'supplierData', attributes: ['id', 'name'] },
          { model: db.product_batch_stock, as: 'stocks' }
        ]
      })
      if (!batch) {
        return res.status(404).json({ success: false, message: 'Batch not found' })
      }
      return res.status(200).json({ success: true, data: batch })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  },

  async getReconcile(req, res) {
    try {
      const storeId = req.query.storeId || req.query.store || req.cookies?.store || null
      const productId = req.query.productId ? parseInt(req.query.productId) : null
      const minDiff = Number(req.query.minDiff || 1)
      const rows = await reconcileService.getDiscrepancies({
        storeId,
        productId,
        minDiff
      })
      return res.status(200).json({ success: true, data: rows, total: rows.length })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  },

  async postReconcile(req, res) {
    try {
      const storeId = req.body.storeId || req.body.store || req.cookies?.store || null
      const productId = req.body.productId ? parseInt(req.body.productId) : null
      const direction = req.body.direction || 'store-to-global'
      if (!['store-to-global', 'global-to-store'].includes(direction)) {
        return res.status(400).json({
          success: false,
          message: 'direction must be store-to-global or global-to-store'
        })
      }
      const result = await reconcileService.reconcile({
        direction,
        storeId,
        productId,
        createdBy: req.user?.id || null
      })
      return res.status(200).json({ success: true, ...result })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  },

  async postWriteOffExpired(req, res) {
    try {
      const storeId = req.body.storeId || req.body.store || req.cookies?.store || null
      const productId = req.body.productId ? parseInt(req.body.productId) : null
      const result = await batchService.writeOffExpired({
        storeId,
        productId,
        createdBy: req.user?.id || null
      })
      return res.status(200).json({ success: true, ...result })
    } catch (error) {
      console.error('Error:', error)
      return res.status(500).json({ success: false, message: error.message })
    }
  }
}

module.exports = inventoryController
