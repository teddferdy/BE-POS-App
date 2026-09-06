const db = require('../../db/models')
const { Op } = require('sequelize')
const { enrichAuditFields } = require('../../utils/auditFields')
const { redactAndAudit, AUDIT_ACTIONS } = require('../../utils/auditLog')
const { withDeadlockRetry } = require('../../utils/deadlockRetry')
const { scalarStoreScope } = require('../../utils/tenantScope')

const DEFAULT_CASH_OUT_APPROVAL_THRESHOLD = 500000
const DEFAULT_CASH_VARIANCE_THRESHOLD = 25000

const getStore = (req) =>
  req.storeId ||
  req.body.storeId ||
  req.body.store ||
  req.query.store ||
  req.cookies.store ||
  req.cookies.activeStore ||
  req.user?.store

// Centralized so close(), getCurrent(), and the X/Z reports (buildReportData)
// can never silently diverge on what "expected cash" means — the exact bug
// this feature fixes (two different formulas coexisted before F2). All
// three call this rather than recomputing any part of it inline.
//
// cashSalesReceived is NET CASH RETAINED IN THE DRAWER (cashReceived minus
// changeGiven), never gross customer tender — do not sum raw cashReceived
// alone for any expected-cash purpose.
async function computeCashLedgerSummary({
  registerId,
  store,
  openingBalance,
  openedAt,
  endAt,
  transaction
}) {
  const replacements = {
    registerId,
    store,
    openedAt,
    endAt: endAt || new Date()
  }
  const queryOpts = {
    replacements,
    type: db.sequelize.QueryTypes.SELECT,
    ...(transaction ? { transaction } : {})
  }

  // F4: intentionally NOT filtered by o.paymentStatus = 'paid'. A
  // transaction row's mere existence already means real, completed money
  // moved (confirmed: every creation site across this codebase writes one
  // exactly when a payment or refund actually happens, never for a
  // pending/speculative one) — cashRegisterId is set once at order
  // creation and never changes. Filtering on the order's CURRENT
  // paymentStatus meant a refund (which routinely moves paymentStatus
  // away from 'paid') silently erased the order's entire cash
  // contribution — both the original sale AND the refund itself — from
  // every subsequent computation. Summing every 'cash' row for the
  // register regardless of the order's current status is what actually
  // nets out correctly: +100,000 cash sale followed by a -20,000 cash
  // refund nets to +80,000, with no special-casing for the status change
  // in between.
  const [cashSalesRow] = await db.sequelize.query(
    `SELECT COALESCE(SUM(COALESCE(t."cashReceived", t.amount) - COALESCE(t."changeGiven", 0)), 0) as "cashSalesReceived"
       FROM "transaction" t
       JOIN "order" o ON o.id = t."order"
      WHERE o."cashRegisterId" = :registerId
        AND t."typePayment" = 'cash'`,
    queryOpts
  )

  // Cash expenses: store + paymentMethod='cash' + status='approved' +
  // createdAt (NOT date — date is free-form/user-editable, createdAt is
  // system-generated) within the register's open window. No createdBy
  // filter — the register's opener is not the only person who can record
  // a cash expense against it. Known limitation: an expense created in one
  // shift but approved in a later shift still attributes to the creation
  // shift, since there is no approvedAt column on expense; not fixed here.
  const [expenseRow] = await db.sequelize.query(
    `SELECT COALESCE(SUM("amount"), 0) as "cashExpenses"
       FROM expense
      WHERE "store" = :store
        AND "paymentMethod" = 'cash'
        AND "status" = 'approved'
        AND "createdAt" >= :openedAt AND "createdAt" <= :endAt`,
    queryOpts
  )

  const [movementRow] = await db.sequelize.query(
    `SELECT
        COALESCE(SUM(CASE WHEN type = 'cash_in'  AND status = 'active' THEN amount ELSE 0 END), 0) as "activeCashIn",
        COALESCE(SUM(CASE WHEN type = 'cash_out' AND status = 'active' THEN amount ELSE 0 END), 0) as "activeCashOut"
       FROM cash_movement
      WHERE "cashRegisterId" = :registerId`,
    queryOpts
  )

  const cashSalesReceived = Number(cashSalesRow.cashSalesReceived || 0)
  const cashExpenses = Number(expenseRow.cashExpenses || 0)
  const activeCashIn = Number(movementRow.activeCashIn || 0)
  const activeCashOut = Number(movementRow.activeCashOut || 0)
  const expectedCash =
    Number(openingBalance || 0) +
    cashSalesReceived +
    activeCashIn -
    activeCashOut -
    cashExpenses

  return { cashSalesReceived, cashExpenses, activeCashIn, activeCashOut, expectedCash }
}

async function buildReportData({
  register,
  store,
  user,
  openedAt,
  endAt,
  storeData,
  userData
}) {
  const replacements = {
    store,
    user,
    openedAt,
    endAt
  }

  // totalSales/totalSubtotal/totalDiscount/totalTax/totalServiceCharge and
  // the payments-by-type breakdown below are UNCHANGED from pre-F2 — gross
  // figures across every payment method, attributed by store+createdBy+
  // time-window. Never used in the expectedCash formula; kept purely for
  // backward-compatible display.
  const [salesAgg, paymentRows, expCatRows] = await Promise.all([
    db.sequelize
      .query(
        `SELECT COUNT(*) as "totalTransactions",
                COALESCE(SUM("subTotal"), 0) as "totalSubtotal",
                COALESCE(SUM("discountAmount"), 0) as "totalDiscount",
                COALESCE(SUM("taxAmount"), 0) as "totalTax",
                COALESCE(SUM("serviceChargeAmount"), 0) as "totalServiceCharge",
                COALESCE(SUM("totalQuantity"), 0) as "totalQuantity",
                COALESCE(SUM("totalCovers"), 0) as "totalCovers",
                COALESCE(SUM("totalPrice"), 0) as "totalSales"
         FROM "order"
         WHERE "store" = :store AND "createdBy" = :user
           AND "createdAt" >= :openedAt AND "createdAt" <= :endAt
           AND "paymentStatus" = 'paid'`,
        { replacements, type: db.sequelize.QueryTypes.SELECT }
      )
      .then((r) => r[0]),
    db.sequelize.query(
      `SELECT t."typePayment",
                COALESCE(SUM(t."amount"), 0) as total,
                COUNT(*)::int as "count"
         FROM "transaction" t
         JOIN "order" o ON o.id = t."order"
         WHERE o."store" = :store AND o."createdBy" = :user
           AND o."createdAt" >= :openedAt AND o."createdAt" <= :endAt
           AND o."paymentStatus" = 'paid'
         GROUP BY t."typePayment"
         ORDER BY total DESC`,
      { replacements, type: db.sequelize.QueryTypes.SELECT }
    ),
    // Same createdBy-removal / date->createdAt correction as the cash
    // expense term above — this breakdown must stay consistent with the
    // total it explains, not silently keep the old buggy attribution.
    // Payment-method scope intentionally left unfiltered (unchanged): this
    // is a general expense-by-category view, not the cash-only figure.
    db.sequelize.query(
      `SELECT COALESCE(ec.name, 'Lainnya') as "category",
                COALESCE(SUM(e."amount"), 0) as total,
                COUNT(*)::int as "count"
         FROM expense e
         LEFT JOIN expense_category ec ON ec.id = e."category"
         WHERE e."store" = :store
           AND e."createdAt" >= :openedAt AND e."createdAt" <= :endAt
           AND e."status" = 'approved'
         GROUP BY ec.name
         ORDER BY total DESC`,
      { replacements, type: db.sequelize.QueryTypes.SELECT }
    )
  ])

  const totalSales = Number(salesAgg.totalSales || 0)
  const totalSubtotal = Number(salesAgg.totalSubtotal || 0)
  const totalDiscount = Number(salesAgg.totalDiscount || 0)
  const totalTax = Number(salesAgg.totalTax || 0)
  const totalServiceCharge = Number(salesAgg.totalServiceCharge || 0)

  const payments = paymentRows.map((r) => ({
    type: r.typePayment,
    amount: Number(r.total || 0),
    count: Number(r.count || 0)
  }))

  const totalNonCashPayment = payments.reduce((s, p) => s + p.amount, 0)

  const openingBalance = Number(register.openingBalance || 0)
  const closingBalance = Number(register.closingBalance || 0)

  const {
    cashSalesReceived,
    cashExpenses,
    activeCashIn,
    activeCashOut,
    expectedCash
  } = await computeCashLedgerSummary({
    registerId: register.id,
    store,
    openingBalance,
    openedAt,
    endAt
  })

  const variance =
    register.status === 'closed' ? closingBalance - expectedCash : null

  return {
    register: {
      id: register.id,
      shift: register.shift,
      status: register.status,
      openedAt: register.openedAt,
      closedAt: register.closedAt,
      notes: register.notes,
      openingBalance,
      closingBalance
    },
    store: storeData
      ? {
          id: storeData.id,
          name: storeData.name,
          address: storeData.address,
          city: storeData.city,
          phone: storeData.phoneNumber || storeData.phone || null
        }
      : null,
    cashier: userData
      ? { id: userData.id, fullName: userData.fullName }
      : { id: user },
    summary: {
      totalTransactions: Number(salesAgg.totalTransactions || 0),
      totalQuantity: Number(salesAgg.totalQuantity || 0),
      totalCovers: Number(salesAgg.totalCovers || 0),
      subtotal: totalSubtotal,
      discount: totalDiscount,
      tax: totalTax,
      serviceCharge: totalServiceCharge,
      totalSales,
      totalExpenses: cashExpenses,
      totalCashPayment: cashSalesReceived,
      totalNonCashPayment,
      activeCashIn,
      activeCashOut,
      expectedCash,
      variance
    },
    payments,
    expenses: expCatRows.map((r) => ({
      category: r.category,
      amount: Number(r.total || 0),
      count: Number(r.count || 0)
    }))
  }
}

const cashRegisterController = {
  async open(req, res) {
    try {
      const store = getStore(req)
      const { openingBalance = 0, shift } = req.body
      const userId = req.user?.id || null

      if (!store) {
        return res.status(400).json({
          success: false,
          message: 'Store not selected'
        })
      }

      // Fast, friendly fast-path — the partial unique index below
      // (cash_register_store_open_unique) is the real, race-safe
      // guarantee for the case this check can't catch.
      const openRegister = await db.cashRegister.findOne({
        where: { store, status: 'open' }
      })

      if (openRegister) {
        return res.status(400).json({
          success: false,
          message: 'Store already has an open cash register'
        })
      }

      let cashRegister
      try {
        cashRegister = await withDeadlockRetry(() =>
          db.sequelize.transaction(async (t) => {
            const created = await db.cashRegister.create(
              {
                store,
                user: userId,
                shift,
                openingBalance,
                status: 'open',
                openedAt: new Date()
              },
              { transaction: t }
            )

            await redactAndAudit(req, {
              action: AUDIT_ACTIONS.CREATE,
              entity: 'cash_register',
              entityId: created.id,
              description: `Opened cash register for store ${store}`,
              newValues: created,
              transaction: t
            })

            return created
          })
        )
      } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
          return res.status(409).json({
            success: false,
            message: 'Store already has an open cash register'
          })
        }
        throw error
      }

      const location = await db.location.findByPk(store, {
        attributes: ['id', 'name', 'address', 'city']
      })

      return res.status(201).json({
        success: true,
        message: 'Cash register opened',
        data: { ...cashRegister.toJSON(), storeData: location }
      })
    } catch (error) {
      console.log(error)
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error'
      })
    }
  },

  async close(req, res) {
    try {
      const { id } = req.params
      const store = getStore(req)
      const { closingBalance, notes } = req.body

      if (!store) {
        return res.status(400).json({
          success: false,
          message: 'Store not selected'
        })
      }

      const result = await withDeadlockRetry(() =>
        db.sequelize.transaction(async (t) => {
          // This lock is the SAME lock createMovement/decideMovement/
          // reverseMovement acquire before acting — that shared contention
          // is what makes "movement against an already-closed register"
          // deterministic (409) rather than racy.
          //
          // Postgres rejects FOR UPDATE combined with a LEFT OUTER JOIN
          // ("FOR UPDATE cannot be applied to the nullable side of an
          // outer join") — Sequelize's belongsTo `include` defaults to
          // LEFT JOIN, so the lock and the include cannot be in the same
          // query. Lock the bare row first, then reload with the
          // associations needed for the response/threshold lookup —
          // still inside the same transaction, still fully consistent,
          // since the lock is already held by the time the reload runs.
          const cashRegister = await db.cashRegister.findOne({
            where: { id, store, status: 'open' },
            transaction: t,
            lock: t.LOCK.UPDATE
          })

          if (!cashRegister) {
            const e = new Error('Open cash register not found')
            e.statusCode = 404
            throw e
          }

          await cashRegister.reload({
            include: [
              {
                model: db.user,
                as: 'userData',
                attributes: ['id', 'fullName']
              },
              {
                model: db.location,
                as: 'storeData',
                attributes: ['id', 'name', 'cashVarianceThreshold']
              }
            ],
            transaction: t
          })

          const pendingCount = await db.cashMovement.count({
            where: {
              cashRegisterId: cashRegister.id,
              status: 'pending_approval'
            },
            transaction: t
          })
          if (pendingCount > 0) {
            const e = new Error(
              'Cannot close: this register has cash movements awaiting approval'
            )
            e.statusCode = 409
            throw e
          }

          const now = new Date()
          const replacements = {
            store,
            user: cashRegister.user,
            openedAt: cashRegister.openedAt,
            now
          }

          // totalSales: UNCHANGED, byte-for-byte identical to pre-F2 —
          // gross paid-order sales across every payment method. Never
          // used in the expectedCash formula below; kept purely for
          // backward-compatible display (see Finding 7).
          const [salesAgg] = await db.sequelize.query(
            `SELECT COALESCE(SUM("totalPrice"), 0) as "totalSales"
             FROM "order"
             WHERE "store" = :store AND "createdBy" = :user
               AND "createdAt" >= :openedAt AND "createdAt" <= :now
               AND "paymentStatus" = 'paid'`,
            { replacements, transaction: t, type: db.sequelize.QueryTypes.SELECT }
          )

          const paymentRows = await db.sequelize.query(
            `SELECT t."typePayment", COALESCE(SUM(t."amount"), 0) as total
             FROM "transaction" t
             JOIN "order" o ON o.id = t."order"
             WHERE o."store" = :store AND o."createdBy" = :user
               AND o."createdAt" >= :openedAt AND o."createdAt" <= :now
               AND o."paymentStatus" = 'paid'
             GROUP BY t."typePayment"`,
            { replacements, transaction: t, type: db.sequelize.QueryTypes.SELECT }
          )

          const totalSales = Number(salesAgg.totalSales || 0)
          const totalPayments = {}
          for (const row of paymentRows) {
            totalPayments[row.typePayment || 'cash'] = Number(row.total || 0)
          }

          const {
            cashSalesReceived,
            cashExpenses,
            activeCashIn,
            activeCashOut,
            expectedCash
          } = await computeCashLedgerSummary({
            registerId: cashRegister.id,
            store,
            openingBalance: cashRegister.openingBalance,
            openedAt: cashRegister.openedAt,
            endAt: now,
            transaction: t
          })

          const variance = (closingBalance || 0) - expectedCash
          const threshold =
            cashRegister.storeData?.cashVarianceThreshold ??
            DEFAULT_CASH_VARIANCE_THRESHOLD
          const varianceApprovalStatus =
            Math.abs(variance) <= threshold ? 'auto_approved' : 'pending_approval'

          await cashRegister.update(
            {
              closingBalance: closingBalance || 0,
              totalSales,
              cashSalesReceived,
              totalExpenses: cashExpenses,
              totalPayments,
              variance,
              varianceApprovalStatus,
              status: 'closed',
              closedAt: now,
              notes
            },
            { transaction: t }
          )

          await redactAndAudit(req, {
            action: AUDIT_ACTIONS.UPDATE,
            entity: 'cash_register',
            entityId: cashRegister.id,
            description: `Closed cash register for store ${store}`,
            oldValues: { status: 'open' },
            newValues: {
              status: 'closed',
              closingBalance: closingBalance || 0,
              variance,
              varianceApprovalStatus
            },
            transaction: t
          })

          return {
            cashRegister,
            totalSales,
            cashSalesReceived,
            totalExpenses: cashExpenses,
            totalPayments,
            activeCashIn,
            activeCashOut,
            expectedCash,
            variance,
            varianceApprovalStatus
          }
        })
      )

      return res.status(200).json({
        success: true,
        message: 'Cash register closed',
        data: {
          register: result.cashRegister,
          summary: {
            openingBalance: result.cashRegister.openingBalance,
            closingBalance: result.cashRegister.closingBalance,
            totalSales: result.totalSales,
            cashSalesReceived: result.cashSalesReceived,
            totalExpenses: result.totalExpenses,
            totalPayments: result.totalPayments,
            activeCashIn: result.activeCashIn,
            activeCashOut: result.activeCashOut,
            expectedCash: result.expectedCash,
            variance: result.variance,
            varianceApprovalStatus: result.varianceApprovalStatus
          }
        }
      })
    } catch (error) {
      console.log(error)
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error'
      })
    }
  },

  // PUT /cash-register/:id/decide-variance — { decision: 'approve' | 'reject' }
  // Only a CLOSED register with varianceApprovalStatus = 'pending_approval'
  // may be decided. Rejecting does NOT reopen the register or change
  // variance — it only records the approval decision and who/when.
  async decideVariance(req, res) {
    try {
      const { id } = req.params
      const { decision } = req.body

      const cashRegister = await db.cashRegister.findOne({
        where: scalarStoreScope(req, { id })
      })

      if (!cashRegister) {
        return res.status(404).json({
          success: false,
          message: 'Cash register not found'
        })
      }

      if (
        cashRegister.status !== 'closed' ||
        cashRegister.varianceApprovalStatus !== 'pending_approval'
      ) {
        return res.status(409).json({
          success: false,
          message: `Cannot decide variance for a register in status ${cashRegister.status}/${cashRegister.varianceApprovalStatus}`
        })
      }

      const newStatus = decision === 'approve' ? 'approved' : 'rejected'

      await cashRegister.update({
        varianceApprovalStatus: newStatus,
        approvedBy: req.user?.id || null,
        approvedAt: new Date()
      })

      await redactAndAudit(req, {
        action:
          decision === 'approve' ? AUDIT_ACTIONS.APPROVE : AUDIT_ACTIONS.REJECT,
        entity: 'cash_register',
        entityId: cashRegister.id,
        description: `Cash register variance ${decision}d`,
        oldValues: { varianceApprovalStatus: 'pending_approval' },
        newValues: { varianceApprovalStatus: newStatus }
      })

      return res.status(200).json({
        success: true,
        message: `Variance ${decision}d`,
        data: cashRegister
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  // POST /cash-register/:id/movement
  async createMovement(req, res) {
    try {
      const { id: cashRegisterId } = req.params
      const { type, reasonCode, amount, notes, idempotencyKey } = req.body

      // Semantic validation deliberately NOT expressed in the Zod schema
      // (see schemas.js comment) — every ZodError resolves to 400, but
      // these two must be 422 per the F2 API contract.
      if (!(Number(amount) > 0)) {
        return res.status(422).json({
          success: false,
          message: 'amount must be positive'
        })
      }
      if (reasonCode === 'other' && !notes?.trim()) {
        return res.status(422).json({
          success: false,
          message: 'notes is required when reasonCode is other'
        })
      }

      // Fast-path idempotency check — a plain read outside the
      // transaction. The authoritative guarantee is the partial unique
      // index, enforced below if two such requests race.
      if (idempotencyKey) {
        const existing = await db.cashMovement.findOne({
          where: { cashRegisterId, idempotencyKey }
        })
        if (existing) {
          return res.status(200).json({
            success: true,
            message: 'Movement already recorded',
            data: existing
          })
        }
      }

      let movement
      try {
        movement = await withDeadlockRetry(() =>
          db.sequelize.transaction(async (t) => {
            // Same Postgres FOR-UPDATE-vs-outer-join constraint as close()
            // — lock the bare row first, then a separate, unlocked read
            // for the threshold.
            const register = await db.cashRegister.findOne({
              where: scalarStoreScope(req, { id: cashRegisterId }),
              transaction: t,
              lock: t.LOCK.UPDATE // serializes against close(), decideMovement(), reverseMovement()
            })
            if (!register) {
              const e = new Error('Cash register not found')
              e.statusCode = 404
              throw e
            }
            if (register.status !== 'open') {
              const e = new Error(
                'Cannot record a cash movement against a closed register'
              )
              e.statusCode = 409
              throw e
            }

            const registerLocation = await db.location.findByPk(register.store, {
              attributes: ['id', 'cashOutApprovalThreshold'],
              transaction: t
            })
            const threshold =
              registerLocation?.cashOutApprovalThreshold ??
              DEFAULT_CASH_OUT_APPROVAL_THRESHOLD
            const status =
              type === 'cash_out' && Number(amount) > threshold
                ? 'pending_approval'
                : 'active'

            const created = await db.cashMovement.create(
              {
                store: register.store,
                cashRegisterId: register.id,
                type,
                reasonCode,
                amount: Number(amount),
                notes: notes || null,
                status,
                createdBy: req.user?.id || null,
                idempotencyKey: idempotencyKey || null
              },
              { transaction: t }
            )

            await redactAndAudit(req, {
              action: AUDIT_ACTIONS.CREATE,
              entity: 'cash_movement',
              entityId: created.id,
              description: `${type} of ${amount} (${reasonCode}) on register ${register.id}`,
              newValues: created,
              transaction: t
            })

            return created
          })
        )
      } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError' && idempotencyKey) {
          const existing = await db.cashMovement.findOne({
            where: { cashRegisterId, idempotencyKey }
          })
          if (existing) {
            return res.status(200).json({
              success: true,
              message: 'Movement already recorded',
              data: existing
            })
          }
        }
        throw error
      }

      return res.status(201).json({
        success: true,
        message: 'Cash movement recorded',
        data: movement
      })
    } catch (error) {
      console.log(error)
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error'
      })
    }
  },

  // POST /cash-register/movement/:id/decide — { decision: 'approve' | 'reject' }
  async decideMovement(req, res) {
    try {
      const { id } = req.params
      const { decision } = req.body

      const movement = await withDeadlockRetry(() =>
        db.sequelize.transaction(async (t) => {
          const mv = await db.cashMovement.findOne({
            where: scalarStoreScope(req, { id }),
            transaction: t
          })
          if (!mv) {
            const e = new Error('Cash movement not found')
            e.statusCode = 404
            throw e
          }

          // Register lock FIRST — same row close() locks.
          const register = await db.cashRegister.findByPk(mv.cashRegisterId, {
            transaction: t,
            lock: t.LOCK.UPDATE
          })
          if (!register || register.status !== 'open') {
            const e = new Error('Cannot decide a movement on a closed register')
            e.statusCode = 409
            throw e
          }

          // THEN the movement row.
          const lockedMv = await db.cashMovement.findByPk(id, {
            transaction: t,
            lock: t.LOCK.UPDATE
          })
          if (lockedMv.status !== 'pending_approval') {
            const e = new Error(
              `Cannot ${decision} a movement in status ${lockedMv.status}`
            )
            e.statusCode = 409
            throw e
          }

          const newStatus = decision === 'approve' ? 'active' : 'rejected'
          await lockedMv.update(
            {
              status: newStatus,
              approvedBy: req.user?.id || null,
              approvedAt: new Date()
            },
            { transaction: t }
          )

          await redactAndAudit(req, {
            action:
              decision === 'approve'
                ? AUDIT_ACTIONS.APPROVE
                : AUDIT_ACTIONS.REJECT,
            entity: 'cash_movement',
            entityId: lockedMv.id,
            description: `Cash movement ${decision}d`,
            oldValues: { status: 'pending_approval' },
            newValues: { status: newStatus },
            transaction: t
          })

          return lockedMv
        })
      )

      return res.status(200).json({
        success: true,
        message: `Movement ${decision}d`,
        data: movement
      })
    } catch (error) {
      console.log(error)
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error'
      })
    }
  },

  // POST /cash-register/movement/:id/reverse
  async reverseMovement(req, res) {
    try {
      const { id } = req.params
      const { notes } = req.body

      const reversal = await withDeadlockRetry(() =>
        db.sequelize.transaction(async (t) => {
          const original = await db.cashMovement.findOne({
            where: scalarStoreScope(req, { id }),
            transaction: t
          })
          if (!original) {
            const e = new Error('Cash movement not found')
            e.statusCode = 404
            throw e
          }

          const register = await db.cashRegister.findByPk(
            original.cashRegisterId,
            { transaction: t, lock: t.LOCK.UPDATE }
          )
          if (!register || register.status !== 'open') {
            const e = new Error('Cannot reverse a movement on a closed register')
            e.statusCode = 409
            throw e
          }

          const lockedOriginal = await db.cashMovement.findByPk(id, {
            transaction: t,
            lock: t.LOCK.UPDATE
          })
          if (lockedOriginal.status !== 'active') {
            const e = new Error(
              `Cannot reverse a movement in status ${lockedOriginal.status}`
            )
            e.statusCode = 409
            throw e
          }

          await lockedOriginal.update({ status: 'reversed' }, { transaction: t })

          const created = await db.cashMovement.create(
            {
              store: register.store,
              cashRegisterId: register.id,
              type: lockedOriginal.type === 'cash_in' ? 'cash_out' : 'cash_in',
              reasonCode: 'correction',
              amount: lockedOriginal.amount,
              notes: notes || `Reversal of movement #${lockedOriginal.id}`,
              status: 'active',
              reversalOfId: lockedOriginal.id,
              createdBy: req.user?.id || null
            },
            { transaction: t }
          )

          await redactAndAudit(req, {
            action: AUDIT_ACTIONS.UPDATE,
            entity: 'cash_movement',
            entityId: lockedOriginal.id,
            description: `Movement reversed by #${created.id}`,
            oldValues: { status: 'active' },
            newValues: { status: 'reversed', reversalId: created.id },
            transaction: t
          })

          return created
        })
      )

      return res.status(201).json({
        success: true,
        message: 'Movement reversed',
        data: reversal
      })
    } catch (error) {
      console.log(error)
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal server error'
      })
    }
  },

  async getCurrent(req, res) {
    try {
      const store = getStore(req)
      const userId = req.user?.id || null

      if (!store) {
        return res.status(400).json({
          success: false,
          message: 'Store not selected'
        })
      }

      const cashRegister = await db.cashRegister.findOne({
        where: { store, user: userId, status: 'open' },
        include: [
          {
            model: db.user,
            as: 'userData',
            attributes: ['id', 'fullName']
          },
          {
            model: db.location,
            as: 'storeData',
            attributes: ['id', 'name', 'address', 'city']
          }
        ]
      })

      if (!cashRegister) {
        return res.status(200).json({
          success: true,
          message: 'No open cash register',
          data: null
        })
      }

      // totalSales: UNCHANGED existing meaning/computation.
      const [salesAgg] = await db.sequelize.query(
        `SELECT COUNT(*) as "totalTransactions",
                COALESCE(SUM("totalPrice"), 0) as "totalSales"
           FROM "order"
          WHERE "store" = :store AND "createdBy" = :user
            AND "createdAt" >= :openedAt AND "paymentStatus" = 'paid'`,
        {
          replacements: { store, user: userId, openedAt: cashRegister.openedAt },
          type: db.sequelize.QueryTypes.SELECT
        }
      )

      const totalSales = Number(salesAgg.totalSales || 0)

      const {
        cashSalesReceived,
        cashExpenses,
        activeCashIn,
        activeCashOut,
        expectedCash
      } = await computeCashLedgerSummary({
        registerId: cashRegister.id,
        store,
        openingBalance: cashRegister.openingBalance,
        openedAt: cashRegister.openedAt,
        endAt: new Date()
      })

      return res.status(200).json({
        success: true,
        message: 'Success get current register',
        data: {
          register: cashRegister,
          currentSales: totalSales,
          cashSalesReceived,
          totalExpenses: cashExpenses,
          activeCashIn,
          activeCashOut,
          totalTransactions: Number(salesAgg.totalTransactions || 0),
          expectedCash
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

  async getHistory(req, res) {
    try {
      const store = getStore(req)
      const { startDate, endDate, page = 1, limit = 50, search } = req.query
      const isSuperAdmin = req.user?.roleType === 'super_admin'

      const where = {}
      if (store) {
        where.store = store
      } else if (!isSuperAdmin) {
        return res.status(400).json({
          success: false,
          message: 'Store not selected'
        })
      }

      if (search) {
        where[Op.or] = [
          { '$userData.fullName$': { [Op.iLike]: `%${search}%` } },
          { '$storeData.name$': { [Op.iLike]: `%${search}%` } },
          { status: { [Op.iLike]: `%${search}%` } }
        ]
      }

      if (startDate || endDate) {
        where.openedAt = {}
        if (startDate) where.openedAt[Op.gte] = new Date(startDate)
        if (endDate) where.openedAt[Op.lte] = new Date(endDate + 'T23:59:59')
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const { count, rows } = await db.cashRegister.findAndCountAll({
        where,
        include: [
          {
            model: db.user,
            as: 'userData',
            attributes: ['id', 'fullName']
          },
          {
            model: db.location,
            as: 'storeData',
            attributes: ['id', 'name', 'address', 'city']
          }
        ],
        order: [['openedAt', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      await enrichAuditFields(db, rows)

      const openRegisters = rows.filter((r) => r.status === 'open')

      let salesMap = {}
      let expenseMap = {}

      if (openRegisters.length > 0) {
        const salesQueries = openRegisters.map(async (row) => {
          const d = row.get({ plain: true })
          const [result] = await db.sequelize.query(
            `SELECT COUNT(*) as "totalTransactions",
                    COALESCE(SUM("totalPrice"), 0) as "totalSales"
             FROM "order"
             WHERE "store" = :store AND "createdBy" = :user
               AND "createdAt" >= :openedAt AND "paymentStatus" = 'paid'`,
            {
              replacements: {
                store: d.store,
                user: d.user,
                openedAt: d.openedAt
              },
              type: db.sequelize.QueryTypes.SELECT
            }
          )
          salesMap[d.id] = {
            totalSales: Number(result.totalSales || 0),
            totalTransactions: Number(result.totalTransactions || 0)
          }
        })

        const expenseQueries = openRegisters.map(async (row) => {
          const d = row.get({ plain: true })
          const [result] = await db.sequelize.query(
            `SELECT COALESCE(SUM("amount"), 0) as "totalExpenses"
             FROM expense
             WHERE "store" = :store AND "createdBy" = :user
               AND "date" >= :openedAt AND "status" = 'approved'`,
            {
              replacements: {
                store: d.store,
                user: d.user,
                openedAt: d.openedAt
              },
              type: db.sequelize.QueryTypes.SELECT
            }
          )
          expenseMap[d.id] = Number(result.totalExpenses || 0)
        })

        await Promise.all([...salesQueries, ...expenseQueries])
      }

      const enriched = rows.map((row) => {
        if (row.status !== 'open') return row
        const data = row.get({ plain: true })
        const sales = salesMap[data.id] || {
          totalSales: 0,
          totalTransactions: 0
        }
        data.totalSales = sales.totalSales
        data.totalExpenses = expenseMap[data.id] || 0
        return data
      })

      return res.status(200).json({
        success: true,
        message: 'Success get register history',
        data: enriched,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
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

  async getOpenRegisters(req, res) {
    try {
      const store = getStore(req)
      const where = { status: 'open' }
      if (store) {
        where.store = store
      }

      const openRegisters = await db.cashRegister.findAll({
        where,
        attributes: ['id', 'store', 'user', 'status', 'openedAt'],
        include: [
          {
            model: db.location,
            as: 'storeData',
            attributes: ['id', 'name']
          },
          {
            model: db.user,
            as: 'userData',
            attributes: ['id', 'fullName']
          }
        ],
        order: [['openedAt', 'ASC']]
      })

      return res.status(200).json({
        success: true,
        message: 'Success get open registers',
        data: openRegisters
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getXReport(req, res) {
    try {
      const store = getStore(req)
      const userId = req.user?.id || null

      if (!store) {
        return res.status(400).json({
          success: false,
          message: 'Store not selected'
        })
      }

      const register = await db.cashRegister.findOne({
        where: { store, user: userId, status: 'open' },
        include: [
          {
            model: db.user,
            as: 'userData',
            attributes: ['id', 'fullName']
          },
          {
            model: db.location,
            as: 'storeData',
            attributes: ['id', 'name', 'address', 'city', 'phoneNumber']
          }
        ]
      })

      if (!register) {
        return res.status(200).json({
          success: true,
          message: 'No open cash register',
          data: null
        })
      }

      const data = await buildReportData({
        register,
        store,
        user: userId,
        openedAt: register.openedAt,
        endAt: new Date(),
        storeData: register.storeData,
        userData: register.userData
      })

      return res.status(200).json({
        success: true,
        message: 'X report generated',
        data
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getZReport(req, res) {
    try {
      const { id } = req.params
      const store = getStore(req)
      const isSuperAdmin = req.user?.roleType === 'super_admin'

      const register = await db.cashRegister.findByPk(id, {
        include: [
          {
            model: db.user,
            as: 'userData',
            attributes: ['id', 'fullName']
          },
          {
            model: db.location,
            as: 'storeData',
            attributes: ['id', 'name', 'address', 'city', 'phoneNumber']
          }
        ]
      })

      if (!register) {
        return res.status(404).json({
          success: false,
          message: 'Cash register not found'
        })
      }

      if (!isSuperAdmin && register.store !== Number(store)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden'
        })
      }

      const data = await buildReportData({
        register,
        store: register.store,
        user: register.user,
        openedAt: register.openedAt,
        endAt: register.closedAt || new Date(),
        storeData: register.storeData,
        userData: register.userData
      })

      return res.status(200).json({
        success: true,
        message: 'Z report generated',
        data
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

module.exports = cashRegisterController
