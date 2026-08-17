const db = require('../../db/models')
const { Op } = require('sequelize')
const { enrichAuditFields } = require('../../utils/auditFields')

const calculateGrade = (score) => {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

const supplierPerformanceController = {
  async getSupplierScores(req, res) {
    try {
      const { search, period, grade, page = 1, limit = 10 } = req.query
      const store = req.query.store

      const where = {}
      if (req.user?.roleType !== 'super_admin') {
        if (req.user?.store) {
          where.store = { [Op.contains]: [Number(req.user.store)] }
        }
      } else if (store && store !== '') {
        where.store = { [Op.contains]: [Number(store)] }
      }

      if (period && period !== 'all') {
        where.period = period
      }
      if (grade && grade !== 'all') {
        where.grade = grade
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const supplierWhere = {}
      if (search) {
        supplierWhere[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { phone: { [Op.iLike]: `%${search}%` } }
        ]
      }

      const [scores, total] = await Promise.all([
        db.supplier_score.findAll({
          where,
          order: [['overallScore', 'DESC']],
          limit: parseInt(limit),
          offset,
          include: [
            {
              model: db.supplier,
              as: 'supplier',
              where:
                Object.keys(supplierWhere).length > 0
                  ? supplierWhere
                  : undefined,
              attributes: ['id', 'name', 'phone', 'email', 'contactPerson']
            }
          ]
        }),
        db.supplier_score.count({
          where,
          include: [
            {
              model: db.supplier,
              as: 'supplier',
              where:
                Object.keys(supplierWhere).length > 0
                  ? supplierWhere
                  : undefined,
              required: true
            }
          ]
        })
      ])

      await enrichAuditFields(db, scores)

      return res.status(200).json({
        success: true,
        message: 'Success get supplier scores',
        data: scores,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getSupplierScoreById(req, res) {
    try {
      const { id } = req.params

      const score = await db.supplier_score.findByPk(id, {
        include: [
          {
            model: db.supplier,
            as: 'supplier',
            attributes: [
              'id',
              'name',
              'phone',
              'email',
              'contactPerson',
              'address'
            ]
          }
        ]
      })

      if (!score) {
        return res
          .status(404)
          .json({ success: false, message: 'Supplier score not found' })
      }

      await enrichAuditFields(db, [score])

      return res.status(200).json({
        success: true,
        message: 'Success get supplier score',
        data: score
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async calculateSupplierScore(req, res) {
    try {
      const { store, supplierId, period, periodStart, periodEnd } = req.body

      const isSuperAdmin = req.user?.roleType === 'super_admin'
      const storeIds = isSuperAdmin ? store : [Number(req.storeId)]
      const storeFilter =
        storeIds && storeIds.length > 0 ? { store: { [Op.in]: storeIds } } : {}

      const startDate = periodStart ? new Date(periodStart) : new Date()
      const endDate = periodEnd ? new Date(periodEnd) : new Date()

      if (period === 'monthly') {
        if (!periodStart) {
          startDate.setDate(1)
          startDate.setHours(0, 0, 0, 0)
        }
        if (!periodEnd) {
          endDate.setMonth(endDate.getMonth() + 1)
          endDate.setDate(0)
          endDate.setHours(23, 59, 59, 999)
        }
      } else if (period === 'quarterly') {
        if (!periodStart) {
          const quarter = Math.floor(startDate.getMonth() / 3)
          startDate.setMonth(quarter * 3, 1)
          startDate.setHours(0, 0, 0, 0)
        }
        if (!periodEnd) {
          const quarter = Math.floor(endDate.getMonth() / 3)
          endDate.setMonth(quarter * 3 + 3, 0)
          endDate.setHours(23, 59, 59, 999)
        }
      } else if (period === 'yearly') {
        if (!periodStart) {
          startDate.setMonth(0, 1)
          startDate.setHours(0, 0, 0, 0)
        }
        if (!periodEnd) {
          endDate.setMonth(11, 31)
          endDate.setHours(23, 59, 59, 999)
        }
      }

      const dateWhere = {}
      if (period !== 'all_time') {
        dateWhere.orderDate = {
          [Op.between]: [startDate, endDate]
        }
      }

      const purchaseOrders = await db.purchase_order.findAll({
        where: {
          ...storeFilter,
          ...dateWhere,
          status: { [Op.in]: ['received', 'ordered'] }
        },
        include: [
          {
            model: db.purchase_order_item,
            as: 'items',
            where: { supplier: Number(supplierId) },
            attributes: ['id', 'quantity', 'price', 'receivedQuantity']
          }
        ]
      })

      const totalOrders = purchaseOrders.length
      let completedOrders = 0
      let cancelledOrders = 0
      let onTimeDeliveries = 0
      let lateDeliveries = 0
      let totalReceivedQty = 0
      let defectiveQty = 0
      let totalPurchaseAmount = 0
      let totalItems = 0
      let totalPriceSum = 0

      for (const po of purchaseOrders) {
        if (po.status === 'received') {
          completedOrders++

          if (po.receivedDate && po.dueDate) {
            const received = new Date(po.receivedDate)
            const due = new Date(po.dueDate)
            if (received <= due) {
              onTimeDeliveries++
            } else {
              lateDeliveries++
            }
          } else if (po.receivedDate) {
            onTimeDeliveries++
          }

          totalPurchaseAmount += po.finalAmount || po.totalAmount || 0

          for (const item of po.items || []) {
            totalReceivedQty += item.receivedQuantity || 0
            totalItems += item.quantity || 0
            totalPriceSum += (item.price || 0) * (item.quantity || 0)
          }
        } else if (po.status === 'cancelled') {
          cancelledOrders++
        }
      }

      const goodsReceipts = await db.goodsReceipt.findAll({
        where: {
          ...storeFilter,
          purchaseOrderId: { [Op.in]: purchaseOrders.map((po) => po.id) },
          status: 'completed'
        },
        include: [
          {
            model: db.goodsReceiptItem,
            as: 'items',
            attributes: ['id', 'qtyReceived', 'conditionNotes']
          }
        ]
      })

      for (const gr of goodsReceipts) {
        for (const item of gr.items || []) {
          if (
            item.conditionNotes &&
            item.conditionNotes.toLowerCase().includes('defect')
          ) {
            defectiveQty += item.qtyReceived || 0
          }
        }
      }

      const onTimeRate =
        totalOrders > 0
          ? ((onTimeDeliveries / totalOrders) * 100).toFixed(2)
          : 0
      const defectRate =
        totalReceivedQty > 0
          ? ((defectiveQty / totalReceivedQty) * 100).toFixed(2)
          : 0
      const avgPricePerItem =
        totalItems > 0 ? Math.round(totalPriceSum / totalItems) : 0

      const competingPrices = await db.purchase_order_item.findAll({
        attributes: [
          'product',
          [db.sequelize.fn('AVG', db.sequelize.col('price')), 'avgPrice']
        ],
        where: {
          product: { [Op.not]: null }
        },
        group: ['product'],
        raw: true
      })

      let priceCompetitivenessScore = 100
      if (avgPricePerItem > 0 && competingPrices.length > 0) {
        const overallAvg =
          competingPrices.reduce(
            (sum, p) => sum + parseFloat(p.avgPrice || 0),
            0
          ) / competingPrices.length
        if (overallAvg > 0) {
          const ratio = avgPricePerItem / overallAvg
          if (ratio <= 0.9) priceCompetitivenessScore = 100
          else if (ratio <= 1.0) priceCompetitivenessScore = 90
          else if (ratio <= 1.1) priceCompetitivenessScore = 75
          else if (ratio <= 1.2) priceCompetitivenessScore = 60
          else priceCompetitivenessScore = 40
        }
      }

      const onTimeWeight = 0.4
      const defectWeight = 0.3
      const priceWeight = 0.3

      const onTimeScore = parseFloat(onTimeRate)
      const defectScore = 100 - parseFloat(defectRate)
      const overallScore = (
        onTimeScore * onTimeWeight +
        defectScore * defectWeight +
        priceCompetitivenessScore * priceWeight
      ).toFixed(2)

      const grade = calculateGrade(parseFloat(overallScore))

      const [score, created] = await db.supplier_score.findOrCreate({
        where: {
          store: storeIds,
          supplierId: Number(supplierId),
          period,
          periodStart: periodStart || startDate.toISOString().split('T')[0],
          periodEnd: periodEnd || endDate.toISOString().split('T')[0]
        },
        defaults: {
          totalOrders,
          completedOrders,
          cancelledOrders,
          onTimeDeliveries,
          lateDeliveries,
          onTimeRate,
          totalReceivedQty,
          defectiveQty,
          defectRate,
          totalPurchaseAmount,
          avgPricePerItem,
          priceCompetitivenessScore,
          overallScore,
          grade,
          calculatedAt: new Date(),
          createdBy: req.user?.id
        }
      })

      if (!created) {
        await score.update({
          totalOrders,
          completedOrders,
          cancelledOrders,
          onTimeDeliveries,
          lateDeliveries,
          onTimeRate,
          totalReceivedQty,
          defectiveQty,
          defectRate,
          totalPurchaseAmount,
          avgPricePerItem,
          priceCompetitivenessScore,
          overallScore,
          grade,
          calculatedAt: new Date(),
          modifiedBy: req.user?.id
        })
      }

      await enrichAuditFields(db, [score])

      return res.status(200).json({
        success: true,
        message: 'Supplier score calculated',
        data: score,
        calculation: {
          totalOrders,
          completedOrders,
          onTimeDeliveries,
          lateDeliveries,
          onTimeRate: parseFloat(onTimeRate),
          totalReceivedQty,
          defectiveQty,
          defectRate: parseFloat(defectRate),
          avgPricePerItem,
          priceCompetitivenessScore,
          overallScore: parseFloat(overallScore),
          grade
        }
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async updateSupplierScoreNote(req, res) {
    try {
      const { id } = req.params
      const { notes } = req.body

      const score = await db.supplier_score.findByPk(id)
      if (!score) {
        return res
          .status(404)
          .json({ success: false, message: 'Supplier score not found' })
      }

      await score.update({
        notes,
        modifiedBy: req.user?.id
      })

      await enrichAuditFields(db, [score])

      return res.status(200).json({
        success: true,
        message: 'Supplier score note updated',
        data: score
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getSupplierPerformanceSummary(req, res) {
    try {
      const { supplierId } = req.params
      const store = req.query.store

      const where = { supplierId: Number(supplierId) }
      if (req.user?.roleType !== 'super_admin') {
        if (req.user?.store) {
          where.store = { [Op.contains]: [Number(req.user.store)] }
        }
      } else if (store && store !== '') {
        where.store = { [Op.contains]: [Number(store)] }
      }

      const scores = await db.supplier_score.findAll({
        where,
        order: [['periodStart', 'DESC']],
        limit: 12,
        include: [
          {
            model: db.supplier,
            as: 'supplier',
            attributes: ['id', 'name', 'phone', 'email']
          }
        ]
      })

      await enrichAuditFields(db, scores)

      const avgScore =
        scores.length > 0
          ? (
              scores.reduce(
                (sum, s) => sum + parseFloat(s.overallScore || 0),
                0
              ) / scores.length
            ).toFixed(2)
          : 0

      const latestScore = scores[0] || null

      return res.status(200).json({
        success: true,
        message: 'Success get supplier performance summary',
        data: {
          supplier: latestScore?.supplier || null,
          averageScore: parseFloat(avgScore),
          latestScore,
          history: scores
        }
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getTopSuppliers(req, res) {
    try {
      const store = req.query.store
      const period = req.query.period || 'all_time'
      const limit = parseInt(req.query.limit) || 5

      const where = { period }
      if (req.user?.roleType !== 'super_admin') {
        if (req.user?.store) {
          where.store = { [Op.contains]: [Number(req.user.store)] }
        }
      } else if (store && store !== '') {
        where.store = { [Op.contains]: [Number(store)] }
      }

      const topSuppliers = await db.supplier_score.findAll({
        where,
        order: [['overallScore', 'DESC']],
        limit,
        include: [
          {
            model: db.supplier,
            as: 'supplier',
            attributes: ['id', 'name', 'phone']
          }
        ]
      })

      await enrichAuditFields(db, topSuppliers)

      return res.status(200).json({
        success: true,
        message: 'Success get top suppliers',
        data: topSuppliers
      })
    } catch (error) {
      console.log(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  }
}

module.exports = supplierPerformanceController
