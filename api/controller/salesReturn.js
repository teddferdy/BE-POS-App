const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')
const { scalarStoreScope } = require('../../utils/tenantScope')
const { withDeadlockRetry } = require('../../utils/deadlockRetry')
const {
  adjustIngredientStockBatch,
  resolveBomIngredientRequirements
} = require('../service/stockMutationService')
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
    // F-RET-2: the whole approval runs under withDeadlockRetry — it now
    // locks return → order → product → ingredient rows, and a concurrent
    // cancellation, goods receipt, or second approval can deadlock against
    // it. A killed transaction committed nothing, so re-running from
    // scratch is safe. Safe to retry: guard failures below throw tagged
    // errors (mapped to responses outside the closure) and no response is
    // ever sent before a retryable error can be thrown.
    const approvalError = (statusCode, message) => {
      const e = new Error(message)
      e.statusCode = statusCode
      return e
    }
    const { id } = req.params
    const { refundReference } = req.body || {}
    let outcome = null
    try {
      outcome = await withDeadlockRetry(async () => {
      const transaction = await db.sequelize.transaction()
      try {

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
          throw approvalError(404, 'Sales return not found')
        }

        if (ret.status !== 'pending') {
          throw approvalError(409, 'Only pending returns can be approved')
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
          throw approvalError(404, 'Original order not found')
        }
        if (['cancelled', 'void'].includes(order.status)) {
          throw approvalError(
            409,
            'Cannot approve a return for an order that has been cancelled'
          )
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
          throw approvalError(
            409,
            `Refund amount (${ret.refundAmount}) exceeds the remaining refundable amount (${remainingRefundable})`
          )
        }

        // Original order lines are immutable once created, so they are the
        // stable source of bundle context for return lines (a return item
        // carries only product + orderItem FK, never bundleId).
        const originalOrderItems = await db.order_item.findAll({
          where: { order: ret.order },
          transaction
        })
        const originalOrderItemById = new Map(
          originalOrderItems.map((oi) => [oi.id, oi])
        )

        // Expand return lines the same way deductStockForOrder expands sale
        // lines: bundle order lines fan out to their components, regular
        // lines stay as-is. Per-line base quantity is qty × conversionToBase
        // (no floor — qty is integer per the create guard, conversion may
        // be fractional, stock columns are DECIMAL). Bundle components are
        // already base-unit quantities, exactly like the sale deducts them.
        const fgRestoreLines = []
        const bomFlatItems = []
        for (const item of ret.items) {
          const lineQty = Number(item.qty) || 0
          if (!(lineQty > 0)) continue
          const conv = Number(item.conversionToBase) || 1
          const originalLine = item.orderItem
            ? originalOrderItemById.get(item.orderItem)
            : null
          const bundleId = originalLine?.bundleId || null
          if (bundleId) {
            const bundle = await db.product_bundle.findByPk(bundleId, {
              include: [{ model: db.product_bundle_item, as: 'items' }],
              transaction
            })
            if (!bundle) {
              throw approvalError(404, `Bundle ${bundleId} not found`)
            }
            for (const bi of bundle.items || []) {
              if (!bi.product) continue
              fgRestoreLines.push({
                productId: bi.product,
                baseQty: Number(bi.quantity) * lineQty,
                unit: null
              })
              bomFlatItems.push({
                productId: bi.product,
                quantity: Number(bi.quantity) * lineQty
              })
            }
            continue
          }
          if (!item.product) continue
          fgRestoreLines.push({
            productId: item.product,
            baseQty: lineQty * conv,
            unit: item.unit || null
          })
          bomFlatItems.push({ productId: item.product, quantity: lineQty })
        }

        // Every distinct product locked once, sorted by id, before any
        // mutation — the same convention as deductStockForOrder (products)
        // and adjustIngredientStockBatch (ingredients, locked sorted
        // inside that helper). Previously products were fetched unlocked
        // and history before/after was computed from the stale read.
        const restoreProductIds = [
          ...new Set(fgRestoreLines.map((l) => l.productId).filter(Boolean))
        ].sort((a, b) => a - b)
        const restoreProducts = restoreProductIds.length
          ? await db.product.findAll({
              where: { id: { [Op.in]: restoreProductIds } },
              lock: transaction.LOCK.UPDATE,
              transaction
            })
          : []
        const restoreProductById = new Map(
          restoreProducts.map((p) => [p.id, p])
        )

        for (const line of fgRestoreLines) {
          if (!restoreProductById.has(line.productId)) {
            throw approvalError(404, `Product ${line.productId} not found`)
          }
        }

        // 1. Restore Stock
        for (const line of fgRestoreLines) {
          const product = restoreProductById.get(line.productId)
          // make_to_order finished goods were never deducted at sale time
          // (ingredients were) — restoring FG here would inflate stock.
          if ((product.inventoryMode || 'stocked') === 'make_to_order') continue
          if (!(line.baseQty > 0)) continue

          const oldStock = Number(product.stock) || 0
          await product.update(
            {
              stock: db.sequelize.literal(`stock + (${line.baseQty})`)
            },
            { transaction }
          )
          // Keep the in-memory row consistent so a second line for the
          // same product later in this loop sees the restored value in
          // its history row (same pattern as deductStockForOrder).
          product.stock = oldStock + line.baseQty

          // Update per-store stock
          await db.sequelize.query(
            `INSERT INTO product_store_stock (product, store, stock, "createdAt", "updatedAt")
             VALUES ($1, $2, 0, NOW(), NOW())
             ON CONFLICT (product, store) DO NOTHING`,
            { bind: [line.productId, ret.store], transaction }
          )
          await db.product_store_stock.update(
            {
              stock: db.sequelize.literal(`stock + (${line.baseQty})`)
            },
            {
              where: { product: line.productId, store: ret.store },
              transaction
            }
          )

          await db.stock_history.create(
            {
              product: line.productId,
              store: ret.store,
              referenceType: 'sale_return',
              referenceId: ret.id,
              quantityBefore: oldStock,
              quantityChange: line.baseQty,
              quantityAfter: oldStock + line.baseQty,
              unit: line.unit || product.unit || 'pcs',
              notes: `Sales return approved: ${ret.reason}`,
              createdBy: req.user?.id || null
            },
            { transaction }
          )
        }

        // 1b. Restore BOM ingredient stock — same helpers, same expansion
        // shape, and same fail-closed contract as the sale path: products
        // in 'stocked' mode resolve to no requirements, anything else
        // without an active BOM throws 409 instead of restoring wrongly.
        // Positive quantities restore (the sale path negates them).
        const bomRequirements = await resolveBomIngredientRequirements(
          bomFlatItems,
          ret.store,
          restoreProductById,
          transaction
        )
        if (bomRequirements.length) {
          await adjustIngredientStockBatch({
            items: bomRequirements,
            store: ret.store,
            referenceType: 'sale_return',
            referenceId: ret.id,
            notes: `Sales return approved: ${ret.returnNumber}`,
            createdBy: req.user?.id || null,
            transaction
          })
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

        // Post-commit side effects stay outside the retried closure above
        // in outcome handling below — attemptJob/createAudit must never
        // run twice for one logical approval.
        return { ret, journalJob }
      } catch (error) {
        await transaction.rollback()
        throw error
      }
      })
    } catch (error) {
      // Tagged validation errors from the approval guards carry their own
      // statusCode; anything else (including a twice-deadlocked run) is a
      // 500 with atomicity preserved by the rollback above.
      if (error && error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        })
      }
      console.error(error)
      return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error'
      })
    }

    const { ret, journalJob } = outcome

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
