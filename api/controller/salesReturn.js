const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')
const { scalarStoreScope } = require('../../utils/tenantScope')
const {
  enqueueAccountingJob,
  attemptJob,
  recordImmediateAttempt
} = require('../service/accountingOutboxService')

const salesReturnController = {
  async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        startDate,
        endDate,
        store: queryStore,
        search
      } = req.query

      // super_admin may optionally filter by a specific store (or see
      // every store when omitted); scalarStoreScope forces everyone else
      // to their own store regardless of what's set here, fixing the
      // previous fail-open bug where a falsy store meant "no filter at
      // all" instead of "match nothing".
      const where = {}
      if (queryStore) where.store = queryStore
      if (status) where.status = status
      if (search) {
        where[Op.or] = [
          { returnNumber: { [Op.iLike]: `%${search}%` } },
          { reason: { [Op.iLike]: `%${search}%` } }
        ]
      }
      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt[Op.gte] = new Date(startDate)
        if (endDate) where.createdAt[Op.lte] = new Date(endDate + 'T23:59:59')
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const { count, rows } = await db.sales_return.findAndCountAll({
        where: scalarStoreScope(req, where),
        include: [
          {
            model: db.sales_return_item,
            as: 'items',
            include: [
              {
                model: db.product,
                as: 'productData',
                attributes: ['id', 'nameProduct']
              }
            ]
          },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] },
          {
            model: db.user,
            as: 'returnedByData',
            attributes: ['id', 'fullName']
          }
        ],
        order: [['updatedAt', 'DESC']],
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
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params

      const ret = await db.sales_return.findOne({
        where: scalarStoreScope(req, { id }),
        include: [
          {
            model: db.sales_return_item,
            as: 'items',
            include: [
              {
                model: db.product,
                as: 'productData',
                attributes: ['id', 'nameProduct']
              }
            ]
          },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] },
          {
            model: db.user,
            as: 'returnedByData',
            attributes: ['id', 'fullName']
          }
        ]
      })

      if (!ret) {
        return res
          .status(404)
          .json({ success: false, message: 'Sales return not found' })
      }

      return res
        .status(200)
        .json({ success: true, message: 'Success', data: ret })
    } catch (error) {
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  },

  async approve(req, res) {
    const transaction = await db.sequelize.transaction()
    try {
      const { id } = req.params
      const { refundReference } = req.body || {}

      // Locked so a concurrent approve() or reject() on the same return
      // (double-click, or two staff acting on it at once) blocks here until
      // this transaction commits or rolls back, instead of both readers
      // seeing status:'pending' and both proceeding — which previously
      // allowed a double refund + double stock restore, or a return ending
      // up 'rejected' after its refund/stock-restore side effects had
      // already run from a concurrent approve().
      //
      // Fetched WITHOUT the `items` include: Postgres refuses FOR UPDATE
      // across the outer join Sequelize generates for a hasMany include
      // ("FOR UPDATE cannot be applied to the nullable side of an outer
      // join") — the items are fetched separately below, once the lock is
      // held.
      const ret = await db.sales_return.findOne({
        where: scalarStoreScope(req, { id }),
        lock: transaction.LOCK.UPDATE,
        transaction
      })

      if (!ret) {
        await transaction.rollback()
        return res
          .status(404)
          .json({ success: false, message: 'Sales return not found' })
      }

      if (ret.status !== 'pending') {
        await transaction.rollback()
        return res.status(409).json({
          success: false,
          message: 'Only pending returns can be approved'
        })
      }

      ret.items = await db.sales_return_item.findAll({
        where: { salesReturn: ret.id },
        transaction
      })

      // Locked so this serializes against a concurrent cancellation of
      // the same order (updateOrderStatus also locks the order row) —
      // previously this was an unlocked read that never even checked the
      // order's status, so approving a return could restore stock a
      // second time immediately after (or concurrently with) a
      // cancellation that had already restored it once. The existing
      // guard in updateOrderStatus (refusing to cancel an order with an
      // *approved* return) only covered the reverse ordering; it did
      // nothing when approve() ran concurrently with, or right after, a
      // cancel that hadn't been reflected here yet.
      const order = await db.order.findByPk(ret.order, {
        lock: transaction.LOCK.UPDATE,
        transaction
      })
      if (!order) {
        await transaction.rollback()
        return res
          .status(404)
          .json({ success: false, message: 'Original order not found' })
      }
      if (['cancelled', 'void'].includes(order.status)) {
        await transaction.rollback()
        return res.status(409).json({
          success: false,
          message:
            'Cannot approve a return for an order that has been cancelled'
        })
      }

      // Authoritative refund-amount invariant — computed fresh from the
      // payment ledger under the order lock just acquired above, which is
      // what serializes this against any other approve() call on the same
      // order (whichever transaction commits first is what the other one
      // observes here). Deliberately NOT derived from order.totalPrice,
      // sales_return.refundAmount history, or paymentStatus — a
      // transaction row's existence is the only real record of money
      // actually moving in this schema (confirmed: every creation site
      // writes one exactly when a real payment or refund happens, never
      // for a pending/speculative one), so summing raw transaction rows
      // is ground truth. This single sum already covers split tender
      // (each split writes its own row), cash and non-cash payments, and
      // both refund-producing mechanisms in this codebase — this
      // sales_return flow AND the order-cancellation auto-refund path —
      // without needing to special-case either.
      const ledgerRows = await db.transaction.findAll({
        where: { order: order.id },
        attributes: ['amount'],
        transaction
      })
      const totalCollected = ledgerRows
        .filter((t) => Number(t.amount) > 0)
        .reduce((sum, t) => sum + Number(t.amount), 0)
      const totalRefunded = ledgerRows
        .filter((t) => Number(t.amount) < 0)
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)
      const remainingRefundable = totalCollected - totalRefunded

      if (Number(ret.refundAmount) > remainingRefundable) {
        await transaction.rollback()
        return res.status(409).json({
          success: false,
          message: `Refund amount (${ret.refundAmount}) exceeds the remaining refundable amount (${remainingRefundable})`
        })
      }

      // Batched into one query instead of one findByPk per item, and
      // reused below for the actual mutation — previously this was two
      // full sequential passes over ret.items (a validation pass, then a
      // separate mutation pass), each re-fetching the same rows: 2N
      // queries where N (plus reuse) suffices.
      const returnProductIds = [
        ...new Set(ret.items.map((item) => item.product).filter(Boolean))
      ]
      const returnProducts = returnProductIds.length
        ? await db.product.findAll({
            where: { id: { [Op.in]: returnProductIds } },
            transaction
          })
        : []
      const returnProductById = new Map(returnProducts.map((p) => [p.id, p]))

      for (const item of ret.items) {
        if (item.product && !returnProductById.has(item.product)) {
          await transaction.rollback()
          return res.status(404).json({
            success: false,
            message: `Product ${item.product} not found`
          })
        }
      }

      // 1. Restore Stock
      for (const item of ret.items) {
        const product = returnProductById.get(item.product)
        if (!product) continue

        const oldStock = Number(product.stock) || 0
        const qty = Math.floor(Number(item.qty)) || 0
        await product.update(
          { stock: db.sequelize.literal(`stock + ${qty}`) },
          { transaction }
        )

        // Update per-store stock
        await db.sequelize.query(
          `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
           VALUES ($1, $2, 0, NOW(), NOW())
           ON CONFLICT (product, store) DO NOTHING`,
          { bind: [item.product, ret.store], transaction }
        )
        await db.product_store_stock.update(
          { stock: db.sequelize.literal(`stock + ${qty}`) },
          { where: { product: item.product, store: ret.store }, transaction }
        )

        await db.stock_history.create(
          {
            product: item.product,
            store: ret.store,
            referenceType: 'sale_return',
            referenceId: ret.id,
            quantityBefore: oldStock,
            quantityChange: qty,
            quantityAfter: oldStock + qty,
            unit: item.unit || product.unit || 'pcs',
            notes: `Sales return approved: ${ret.reason}`,
            createdBy: req.user?.id || null
          },
          { transaction }
        )
      }

      // 2. Refund Transaction
      if (ret.refundAmount > 0) {
        await db.transaction.create(
          {
            order: ret.order,
            salesReturnId: ret.id,
            typePayment: ret.refundMethod || 'cash',
            amount: -Math.abs(ret.refundAmount),
            notes: `Refund for return ${ret.returnNumber}`,
            createdBy: req.user?.id || null
          },
          { transaction }
        )
      }

      // 3. Update Return Status + approval metadata — populated only
      // here, atomically with the transition, never accepted at create
      // time and never editable afterward.
      const approvedAt = new Date()
      await ret.update(
        {
          status: 'approved',
          approvedBy: req.user?.id || null,
          approvedAt,
          refundReference: refundReference || null
        },
        { transaction }
      )

      // 4. Recompute Order Payment Status
      const updatedOrder = await db.order.findByPk(ret.order, {
        include: [{ model: db.transaction, as: 'transactions' }],
        transaction
      })
      if (updatedOrder) {
        const totalPaid = updatedOrder.transactions.reduce(
          (sum, t) => sum + Number(t.amount),
          0
        )
        let newPaymentStatus = 'unpaid'
        if (totalPaid >= updatedOrder.totalPrice) {
          newPaymentStatus = 'paid'
        } else if (totalPaid > 0) {
          newPaymentStatus = 'partial'
        }
        await updatedOrder.update(
          { paymentStatus: newPaymentStatus },
          { transaction }
        )
      }

      // Durable inside the same transaction as the refund ledger row and
      // status update above — a posting failure below is retried, not
      // silently discarded (see accountingOutboxService.js).
      const journalJob = await enqueueAccountingJob({
        jobType: 'sales_return_journal',
        store: ret.store,
        referenceType: 'sales_return',
        referenceId: ret.id,
        payload: {
          store: ret.store,
          returnId: ret.id,
          returnNumber: ret.returnNumber,
          orderId: ret.order,
          refundAmount: ret.refundAmount,
          refundMethod: ret.refundMethod,
          items: ret.items || [],
          date: new Date().toISOString(),
          createdBy: req.user?.id
        },
        transaction
      })

      await transaction.commit()

      const journalResult = await attemptJob(journalJob)
      await recordImmediateAttempt(journalJob, journalResult)
      if (!journalResult.ok) {
        console.error('Sales return journal deferred to retry queue:', journalResult.error)
      }

      await createAudit(
        req,
        'update',
        'sales_return',
        id,
        'Approved sales return: ' + ret.returnNumber
      )

      return res
        .status(200)
        .json({ success: true, message: 'Sales return approved', data: ret })
    } catch (error) {
      await transaction.rollback()
      console.error(error)
      return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error'
      })
    }
  },

  async reject(req, res) {
    // Runs in its own transaction with the return row locked, same as
    // approve() — previously this had no transaction and no lock at all,
    // so a reject() landing while a concurrent approve() was still
    // mid-flight (unlocked, or racing before this fix) could leave the
    // return visibly 'rejected' even though approve()'s refund and
    // stock-restore had already executed. Locking here means reject()
    // now blocks behind whichever of the two got to the row first, then
    // correctly sees the already-updated status and bails out below.
    const transaction = await db.sequelize.transaction()
    try {
      const { id } = req.params

      const ret = await db.sales_return.findOne({
        where: scalarStoreScope(req, { id }),
        lock: transaction.LOCK.UPDATE,
        transaction
      })
      if (!ret) {
        await transaction.rollback()
        return res
          .status(404)
          .json({ success: false, message: 'Sales return not found' })
      }

      if (ret.status === 'rejected') {
        await transaction.commit()
        return res.status(200).json({
          success: true,
          message: 'Sales return already rejected',
          data: ret
        })
      }

      if (ret.status !== 'pending') {
        await transaction.rollback()
        return res.status(409).json({
          success: false,
          message: 'Only pending returns can be rejected'
        })
      }

      await ret.update({ status: 'rejected' }, { transaction })
      await transaction.commit()

      await createAudit(
        req,
        'update',
        'sales_return',
        id,
        'Rejected sales return: ' + ret.returnNumber
      )

      return res
        .status(200)
        .json({ success: true, message: 'Sales return rejected', data: ret })
    } catch (error) {
      await transaction.rollback()
      console.error(error)
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' })
    }
  }
}

module.exports = salesReturnController
