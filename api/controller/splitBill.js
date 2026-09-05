const db = require('../../db/models')
const { createAudit } = require('../../utils/auditLog')
const { deductStockForPaidOrder } = require('./order')
const { scalarStoreScope } = require('../../utils/tenantScope')

// split_bill has no store column of its own — ownership is entirely
// inherited through order.store (a plain INTEGER, same shape scalarStoreScope
// already handles), so every entry point below that receives a raw order id
// or a split id first proves the parent order belongs to the caller's store
// before any lock/mutation happens. No new relation-aware helper is needed:
// this reduces to a scalarStoreScope-scoped fetch of the order that these
// functions already have to fetch anyway.

const generateSplitNumber = () => {
  const date = new Date()
  const timestamp = date.getTime().toString().slice(-8)
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `SPL${timestamp}${random}`
}

const splitBillController = {
  async create(req, res) {
    const transaction = await db.sequelize.transaction()
    try {
      const { order, items } = req.body
      const createdBy = req.user?.id || null

      if (!order || !items || items.length === 0) {
        await transaction.rollback()
        return res.status(400).json({
          success: false,
          message: 'Order and items are required'
        })
      }

      // Lock the parent order row as the serialization point for "does an
      // active split set already exist for this order" — there's no
      // existing split_bill row to lock when none exist yet, so two
      // concurrent create() calls for the same order would otherwise both
      // pass the empty/no-pending check below and both insert a full set,
      // doubling the tracked total for the order.
      // IDOR fix: was findByPk(order) with no store filter — a Store A
      // user could create split bills against another store's order.
      const orderRow = await db.order.findOne({
        where: scalarStoreScope(req, { id: order }),
        lock: transaction.LOCK.UPDATE,
        transaction
      })
      if (!orderRow) {
        await transaction.rollback()
        return res.status(404).json({ success: false, message: 'Order not found' })
      }

      const existingSplits = await db.split_bill.findAll({
        where: { order },
        transaction
      })

      if (
        existingSplits.length > 0 &&
        existingSplits.some((s) => s.status === 'pending')
      ) {
        await transaction.rollback()
        return res.status(400).json({
          success: false,
          message:
            'Order already has pending split bills. Complete or cancel them first.'
        })
      }

      const splits = []
      for (const item of items) {
        const split = await db.split_bill.create(
          {
            order,
            splitNumber: generateSplitNumber(),
            amount: item.amount,
            status: 'pending',
            createdBy
          },
          { transaction }
        )
        splits.push(split)
      }

      await transaction.commit()

      await createAudit(
        req,
        'create',
        'split_bill',
        splits[0]?.id,
        'Created split_bill for order: ' + order
      )

      return res.status(201).json({
        success: true,
        message: 'Success create split bills',
        data: splits
      })
    } catch (error) {
      await transaction.rollback()
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getByOrder(req, res) {
    try {
      const { orderId } = req.params

      // Same IDOR fix as create() — was an unscoped split_bill read keyed
      // only on orderId, leaking another store's split/payment amounts.
      const orderRow = await db.order.findOne({
        where: scalarStoreScope(req, { id: orderId })
      })
      if (!orderRow) {
        return res.status(404).json({ success: false, message: 'Order not found' })
      }

      const splits = await db.split_bill.findAll({
        where: { order: orderId },
        order: [['createdAt', 'DESC']]
      })

      const totalPaid = splits
        .filter((s) => s.status === 'paid')
        .reduce((sum, s) => sum + s.amount, 0)

      const totalPending = splits
        .filter((s) => s.status === 'pending')
        .reduce((sum, s) => sum + s.amount, 0)

      return res.status(200).json({
        success: true,
        message: 'Success get split bills',
        data: {
          splits,
          summary: {
            totalSplits: splits.length,
            totalPaid,
            totalPending
          }
        }
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async pay(req, res) {
    const transaction = await db.sequelize.transaction()
    let orderCompleted = null
    try {
      const { id } = req.params
      const { paymentMethod } = req.body

      // Peek at the row (unlocked) purely to learn which order this split
      // belongs to — the authoritative, race-safe read is the locked
      // group-read below.
      const target = await db.split_bill.findByPk(id, { transaction })
      if (!target) {
        await transaction.rollback()
        return res.status(404).json({
          success: false,
          message: 'Split bill not found'
        })
      }

      // IDOR fix: verify the parent order belongs to the caller's store
      // before doing anything else. Unlocked is fine here — a store
      // assignment never changes after an order is created, so nothing
      // downstream in this transaction can invalidate this check. Reuses
      // the same "Split bill not found" message as the !target branch
      // above so a cross-tenant probe can't distinguish "doesn't exist"
      // from "exists but isn't yours".
      const parentOrder = await db.order.findOne({
        where: scalarStoreScope(req, { id: target.order }),
        transaction
      })
      if (!parentOrder) {
        await transaction.rollback()
        return res.status(404).json({
          success: false,
          message: 'Split bill not found'
        })
      }

      // Lock every split row for this order (not just the one being paid),
      // in a stable order. This is what makes "are all splits now paid"
      // below race-safe: if two different splits of the same order were
      // paid at the same instant, each transaction would otherwise read
      // the other split as still 'pending' (neither had committed yet)
      // and NEITHER would ever detect completion — the order would never
      // transition to paid even though every split had been paid.
      const allSplits = await db.split_bill.findAll({
        where: { order: target.order },
        order: [['id', 'ASC']],
        lock: transaction.LOCK.UPDATE,
        transaction
      })
      const split = allSplits.find((s) => s.id === Number(id))

      if (split.status === 'paid') {
        await transaction.rollback()
        return res.status(400).json({
          success: false,
          message: 'Split bill already paid'
        })
      }

      await split.update({ status: 'paid', paymentMethod }, { transaction })

      // Every split payment is its own real payment — record it on the
      // payment ledger as it happens, not as a single lump sum guessed at
      // completion. Previously split-bill never wrote to this table at
      // all, so orders paid this way were invisible to cash-register
      // reconciliation and revenue reporting.
      await db.transaction.create(
        {
          order: split.order,
          typePayment: paymentMethod || 'cash',
          amount: Number(split.amount) || 0,
          notes: `Split bill payment: ${split.splitNumber}`,
          createdBy: req.user?.id || null
        },
        { transaction }
      )

      const allPaid = allSplits.every((s) =>
        s.id === split.id ? true : s.status === 'paid'
      )

      let orderComplete = false
      if (allPaid) {
        const order = await db.order.findByPk(split.order, {
          lock: transaction.LOCK.UPDATE,
          transaction
        })
        // Guard against re-running completion if this order was somehow
        // already marked paid (e.g. by another payment path) — makes this
        // branch idempotent rather than double-deducting stock. Also
        // refuse a cancelled/voided order outright: cancellation sets
        // paymentStatus to 'refunded' (not 'paid'), so a bare
        // paymentStatus-only check here would pass and revive a
        // cancelled order back to 'paid' — re-deducting stock on top of
        // whatever the cancellation already restored. Both this check and
        // updateOrderStatus's cancel path lock the same order row, so
        // whichever operation commits first is what the other observes.
        if (
          order &&
          order.paymentStatus !== 'paid' &&
          !['cancelled', 'void'].includes(order.status)
        ) {
          await deductStockForPaidOrder(
            order.id,
            order.store,
            order.orderNumber,
            req.user?.id || null,
            transaction
          )
          await order.update(
            { status: 'paid', paymentStatus: 'paid' },
            { transaction }
          )
          if (order.tableId) {
            await db.table.update(
              { status: 'available' },
              { where: { id: order.tableId }, transaction }
            )
          }
          orderCompleted = order
          orderComplete = true
        } else if (order && order.paymentStatus === 'paid') {
          // Already completed via another path — still a true "complete".
          orderComplete = true
        }
        // If the order was cancelled/voided, orderComplete stays false:
        // every split is paid, but the order itself was not (and must
        // not be) revived.
      }

      await transaction.commit()

      await createAudit(
        req,
        'update',
        'split_bill',
        split.id,
        'Updated split_bill: ' + split.id
      )

      // Accounting journal posting follows the same pattern as every other
      // order-completion path in this codebase: best-effort, after commit,
      // never rolling back already-committed business data on failure.
      if (orderCompleted) {
        try {
          const {
            postOrderJournal,
            postOrderCogsJournal
          } = require('../service/accountingService')
          await postOrderJournal({
            store: orderCompleted.store,
            orderId: orderCompleted.id,
            orderNumber: orderCompleted.orderNumber,
            subTotal: orderCompleted.subTotal,
            discountAmount: orderCompleted.discountAmount,
            taxAmount: orderCompleted.taxAmount,
            serviceChargeAmount: orderCompleted.serviceChargeAmount,
            totalPrice: orderCompleted.totalPrice,
            date: new Date(),
            paymentMethod: 'split',
            createdBy: req.user?.id
          })
          await postOrderCogsJournal({
            store: orderCompleted.store,
            orderId: orderCompleted.id,
            orderNumber: orderCompleted.orderNumber,
            date: new Date(),
            createdBy: req.user?.id
          })
        } catch (e) {
          console.error('Split-bill accounting posting skipped:', e.message)
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Success pay split bill',
        data: {
          split,
          orderComplete
        }
      })
    } catch (error) {
      await transaction.rollback()
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async cancel(req, res) {
    const transaction = await db.sequelize.transaction()
    try {
      const { id } = req.params

      const split = await db.split_bill.findOne({
        where: { id },
        lock: transaction.LOCK.UPDATE,
        transaction
      })

      if (!split) {
        await transaction.rollback()
        return res.status(404).json({
          success: false,
          message: 'Split bill not found'
        })
      }

      // IDOR fix: verify the parent order belongs to the caller's store
      // before allowing the destroy below.
      const parentOrder = await db.order.findOne({
        where: scalarStoreScope(req, { id: split.order }),
        transaction
      })
      if (!parentOrder) {
        await transaction.rollback()
        return res.status(404).json({
          success: false,
          message: 'Split bill not found'
        })
      }

      // A paid split is a completed payment with its own ledger entry —
      // deleting it would silently erase that from getByOrder's totals
      // with no reversal of the order's paymentStatus. Only a still-
      // pending split can be cancelled.
      if (split.status === 'paid') {
        await transaction.rollback()
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel a split bill that has already been paid'
        })
      }

      await split.destroy({ transaction })
      await transaction.commit()

      await createAudit(
        req,
        'delete',
        'split_bill',
        id,
        'Deleted split_bill: ' + id
      )

      return res.status(200).json({
        success: true,
        message: 'Success cancel split bill'
      })
    } catch (error) {
      await transaction.rollback()
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async merge(req, res) {
    const transaction = await db.sequelize.transaction()
    try {
      const { order, splitIds } = req.body

      if (!splitIds || splitIds.length < 2) {
        await transaction.rollback()
        return res.status(400).json({
          success: false,
          message: 'At least 2 split bills required to merge'
        })
      }

      // IDOR fix: `order` is client-supplied and was used directly in the
      // splits query below with no proof it belongs to the caller's store
      // — verify it up front before touching any split_bill row.
      const parentOrder = await db.order.findOne({
        where: scalarStoreScope(req, { id: order }),
        transaction
      })
      if (!parentOrder) {
        await transaction.rollback()
        return res.status(404).json({ success: false, message: 'Order not found' })
      }

      // Sorted, locked read of exactly the rows being merged — a crash
      // between the destroy and the create below can no longer happen
      // (both are in this one transaction), and locking first means a
      // concurrent pay() on one of these splits blocks until this merge
      // either commits or rolls back, instead of racing it.
      const sortedIds = [...splitIds].sort((a, b) => a - b)
      const splits = await db.split_bill.findAll({
        where: {
          id: { [db.Sequelize.Op.in]: sortedIds },
          order,
          status: 'pending'
        },
        order: [['id', 'ASC']],
        lock: transaction.LOCK.UPDATE,
        transaction
      })

      if (splits.length !== splitIds.length) {
        await transaction.rollback()
        return res.status(400).json({
          success: false,
          message: 'Some split bills not found or already paid'
        })
      }

      const totalAmount = splits.reduce((sum, s) => sum + s.amount, 0)

      await db.split_bill.destroy({
        where: { id: { [db.Sequelize.Op.in]: sortedIds } },
        transaction
      })

      const newSplit = await db.split_bill.create(
        {
          order,
          splitNumber: generateSplitNumber(),
          amount: totalAmount,
          status: 'pending'
        },
        { transaction }
      )

      await transaction.commit()

      await createAudit(
        req,
        'update',
        'split_bill',
        newSplit.id,
        'Merged split_bill: ' + newSplit.id
      )

      return res.status(201).json({
        success: true,
        message: 'Success merge split bills',
        data: newSplit
      })
    } catch (error) {
      await transaction.rollback()
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }
}

module.exports = splitBillController
