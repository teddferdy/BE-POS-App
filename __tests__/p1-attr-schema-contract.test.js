process.env.NODE_ENV = 'test'

const harness = require('../scripts/rehearse-staging')
const { LOCAL_HOSTS } = require('../scripts/check-migration-preflight')

// PAYMENT P1 Register & Settlement Attribution — migration/schema foundation.
//
// TDD contract tests (ATTR-SCHEMA-01..17) for the locked migration contract:
//   M1  transaction.cashRegisterId + transaction.splitBillId (+ indexes)
//   M2  linkage hardening: salesReturnId FK/index + the two M1 FKs
//   M3  canonical typePayment CHECK, NOT VALID (legacy rows untouched)
//   M4  createdBy CHECK — DEFERRED (no migration; documented prerequisite)
//   M5  cash_register closed-snapshot columns
//   M6  no VALIDATE CONSTRAINT in this phase
//
// Exercised against a disposable database (never the shared test DB, never
// staging, never production), following the D-05 migration-test precedent:
// minimal table shells mirror the current models; each migration's up()/down()
// runs against them; PostgreSQL catalogs are the assertions. No backfill,
// no row deletion, no legacy-row validation anywhere in this phase.

const DB = `cashier_app_p1attr_schema_${process.pid}`
const M1 = '20261013000001-p1-transaction-attribution.js'
const M2 = '20261013000002-p1-transaction-linkage-fks.js'
const M3 = '20261013000003-p1-canonical-payment-check.js'
const M5 = '20261013000004-p1-register-close-snapshot.js'

const CANONICAL_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'E_WALLET', 'QRIS', 'POINTS', 'OTHER']

let sequelize = null
const qi = () => sequelize.getQueryInterface()
const runUp = (name) => require(`../db/migrations/${name}`).up(qi(), require('sequelize'))
const runDown = (name) => require(`../db/migrations/${name}`).down(qi(), require('sequelize'))

const select = (sql) => sequelize.query(sql, { type: sequelize.QueryTypes.SELECT })

const TXN_SHELL = `CREATE TABLE "transaction" (
  id SERIAL PRIMARY KEY,
  "order" INTEGER NOT NULL,
  "typePayment" VARCHAR(255) NOT NULL,
  amount BIGINT NOT NULL,
  "referenceNumber" VARCHAR(255),
  notes TEXT,
  "createdBy" INTEGER,
  "salesReturnId" INTEGER,
  "cashReceived" BIGINT,
  "changeGiven" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
)`
const SPLIT_SHELL = `CREATE TABLE "split_bill" (
  id SERIAL PRIMARY KEY,
  "order" INTEGER NOT NULL,
  "splitNumber" VARCHAR(255) NOT NULL,
  amount INTEGER NOT NULL,
  status VARCHAR(255) NOT NULL DEFAULT 'pending',
  "paymentMethod" VARCHAR(255),
  "createdBy" INTEGER,
  "idempotencyKey" VARCHAR(255),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
)`
const SALES_RETURN_SHELL = `CREATE TABLE "sales_return" (
  id SERIAL PRIMARY KEY,
  "order" INTEGER NOT NULL,
  status VARCHAR(255) NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
)`
const REGISTER_SHELL = `CREATE TABLE "cash_register" (
  id SERIAL PRIMARY KEY,
  store INTEGER,
  "user" INTEGER NOT NULL,
  "openingBalance" INTEGER DEFAULT 0,
  "closingBalance" INTEGER DEFAULT 0,
  "totalSales" INTEGER DEFAULT 0,
  "totalExpenses" INTEGER DEFAULT 0,
  "totalPayments" JSONB DEFAULT '{}'::jsonb,
  "cashSalesReceived" INTEGER,
  status VARCHAR(255) DEFAULT 'open',
  "openedAt" TIMESTAMPTZ,
  "closedAt" TIMESTAMPTZ,
  notes TEXT,
  variance INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
)`

const columnInfo = async (table, column) => {
  const rows = await select(
    `SELECT column_name, is_nullable, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}'`
  )
  return rows[0] || null
}

const constraintDef = async (name) => {
  const rows = await select(`SELECT conname, pg_get_constraintdef(oid) AS def, convalidated FROM pg_constraint WHERE conname = '${name}'`)
  return rows[0] || null
}

const indexNames = async (table) => {
  const rows = await select(`SELECT indexname FROM pg_indexes WHERE tablename = '${table}'`)
  return rows.map((r) => r.indexname)
}

const fkInfo = async (table, column) => {
  const rows = await select(
    `SELECT c.conname, c.confupdtype, c.confdeltype, c.convalidated,
            t2.relname AS ftable
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_class t2 ON t2.oid = c.confrelid
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND t.relname = '${table}' AND a.attname = '${column}'`
  )
  return rows[0] || null
}
// confdeltype/confupdtype codes: a=no action, r=restrict, c=cascade, n=set null, d=set default

const tableCount = async (table) => {
  const rows = await select(`SELECT count(*)::int AS n FROM "${table}"`)
  return rows[0].n
}

beforeAll(async () => {
  const admin = harness.stagingConnection({ database: DB })
  if (!LOCAL_HOSTS.includes(String(admin.host || '').toLowerCase())) {
    throw new Error(`refusing P1 schema-contract test against non-local host "${admin.host}"`)
  }
  await harness.createDatabase(admin, DB)
  sequelize = harness.newSequelize({ ...admin, database: DB })
}, 60000)

afterAll(async () => {
  if (sequelize) await sequelize.close().catch(() => {})
  sequelize = null
  await harness.dropDatabase(harness.stagingConnection({ database: DB }), DB).catch(() => {})
})

beforeEach(async () => {
  await sequelize.query('DROP TABLE IF EXISTS "transaction" CASCADE')
  await sequelize.query('DROP TABLE IF EXISTS "split_bill" CASCADE')
  await sequelize.query('DROP TABLE IF EXISTS "sales_return" CASCADE')
  await sequelize.query('DROP TABLE IF EXISTS "cash_register" CASCADE')
  await sequelize.query(TXN_SHELL)
  await sequelize.query(SPLIT_SHELL)
  await sequelize.query(SALES_RETURN_SHELL)
  await sequelize.query(REGISTER_SHELL)
})

describe('M1 — transaction attribution columns (ATTR-SCHEMA-01/03/04/11/13/16)', () => {
  test('ATTR-SCHEMA-01: transaction.cashRegisterId exists and is nullable', async () => {
    await runUp(M1)
    const col = await columnInfo('transaction', 'cashRegisterId')
    expect(col).not.toBeNull()
    expect(col.is_nullable).toBe('YES')
  })

  test('ATTR-SCHEMA-03: transaction.cashRegisterId has the required index', async () => {
    await runUp(M1)
    expect(await indexNames('transaction')).toContain('transaction_cashregisterid')
  })

  test('ATTR-SCHEMA-04: transaction.splitBillId exists and is nullable', async () => {
    await runUp(M1)
    const col = await columnInfo('transaction', 'splitBillId')
    expect(col).not.toBeNull()
    expect(col.is_nullable).toBe('YES')
  })

  test('ATTR-SCHEMA-11: legacy NULL cashRegisterId remains possible after M1', async () => {
    await runUp(M1)
    await sequelize.query(
      `INSERT INTO "transaction" ("order", "typePayment", amount) VALUES (1, 'cash', 10000)`
    )
    const rows = await select(`SELECT "cashRegisterId" FROM "transaction" WHERE "order" = 1`)
    expect(rows).toHaveLength(1)
    expect(rows[0].cashRegisterId).toBeNull()
  })

  test('ATTR-SCHEMA-13: M1 backfills zero rows and deletes zero rows', async () => {
    await sequelize.query(
      `INSERT INTO "transaction" ("order", "typePayment", amount, "createdBy") VALUES
       (1, 'cash', 10000, NULL),
       (1, 'tunai', 5000, 7)`
    )
    const before = await tableCount('transaction')
    await runUp(M1)
    expect(await tableCount('transaction')).toBe(before)
    const rows = await select(`SELECT "typePayment", "createdBy", "cashRegisterId", "splitBillId" FROM "transaction" ORDER BY id`)
    expect(rows).toEqual([
      { typePayment: 'cash', createdBy: null, cashRegisterId: null, splitBillId: null },
      { typePayment: 'tunai', createdBy: 7, cashRegisterId: null, splitBillId: null }
    ])
  })

  test('ATTR-SCHEMA-16: M1 is idempotent and guarded', async () => {
    const mig = require(`../db/migrations/${M1}`)
    expect(typeof mig.up).toBe('function')
    expect(typeof mig.down).toBe('function')
    await runUp(M1)
    await runUp(M1)
    expect(await columnInfo('transaction', 'cashRegisterId')).not.toBeNull()
  })
})

describe('M2 — linkage hardening (ATTR-SCHEMA-02/05/06/07)', () => {
  test('ATTR-SCHEMA-02: transaction.cashRegisterId references cash_register.id', async () => {
    await runUp(M1)
    await runUp(M2)
    const fk = await fkInfo('transaction', 'cashRegisterId')
    expect(fk).not.toBeNull()
    expect(fk.ftable).toBe('cash_register')
    expect(fk.confupdtype).toBe('c')
    expect(fk.confdeltype).toBe('n')
  })

  test('ATTR-SCHEMA-05: transaction.splitBillId references split_bill.id', async () => {
    await runUp(M1)
    await runUp(M2)
    const fk = await fkInfo('transaction', 'splitBillId')
    expect(fk).not.toBeNull()
    expect(fk.ftable).toBe('split_bill')
  })

  test('ATTR-SCHEMA-06: transaction.splitBillId is not CASCADE-delete', async () => {
    await runUp(M1)
    await runUp(M2)
    const fk = await fkInfo('transaction', 'splitBillId')
    expect(fk.confdeltype).not.toBe('c')
    // Retiring a split plan must never delete its ledger event.
    await sequelize.query(`INSERT INTO "split_bill" ("order", "splitNumber", amount, status) VALUES (1, 'SPL1', 10000, 'paid')`)
    await sequelize.query(
      `INSERT INTO "transaction" ("order", "typePayment", amount, "splitBillId") VALUES (1, 'cash', 10000, 1)`
    )
    await sequelize.query(`DELETE FROM "split_bill" WHERE id = 1`)
    expect(await tableCount('transaction')).toBe(1)
  })

  test('ATTR-SCHEMA-07: transaction.salesReturnId remains intact and gains FK/index integrity', async () => {
    await runUp(M1)
    await runUp(M2)
    expect(await columnInfo('transaction', 'salesReturnId')).not.toBeNull()
    const fk = await fkInfo('transaction', 'salesReturnId')
    expect(fk).not.toBeNull()
    expect(fk.ftable).toBe('sales_return')
    expect(fk.confdeltype).toBe('r')
    expect(await indexNames('transaction')).toContain('transaction_salesreturnid')
  })

  test('M2 orphan preflight fails closed without mutating financial history', async () => {
    await runUp(M1)
    await sequelize.query(
      `INSERT INTO "transaction" ("order", "typePayment", amount, "salesReturnId") VALUES (1, 'cash', 10000, 999999)`
    )
    await expect(runUp(M2)).rejects.toThrow(/orphan|BLOCKED/i)
    expect(await fkInfo('transaction', 'salesReturnId')).toBeNull()
    expect(await tableCount('transaction')).toBe(1)
    const rows = await select(`SELECT "salesReturnId" FROM "transaction"`)
    expect(rows[0].salesReturnId).toBe(999999)
  })
})

describe('M3 — canonical payment CHECK (ATTR-SCHEMA-08/09/10)', () => {
  test('ATTR-SCHEMA-08: typePayment remains a string-compatible column', async () => {
    await runUp(M1)
    await runUp(M3)
    const col = await columnInfo('transaction', 'typePayment')
    expect(col.data_type).toBe('character varying')
  })

  test('ATTR-SCHEMA-09: canonical payment CHECK contains exactly the seven locked methods', async () => {
    await runUp(M3)
    const con = await constraintDef('transaction_typepayment_canonical')
    expect(con).not.toBeNull()
    for (const m of CANONICAL_METHODS) expect(con.def).toContain(`'${m}'`)
    expect(con.def).not.toMatch(/'cash'| 'tunai'|Cash/)
  })

  test('ATTR-SCHEMA-10: CHECK is NOT VALID; legacy rows untouched, new alias rows refused', async () => {
    await sequelize.query(
      `INSERT INTO "transaction" ("order", "typePayment", amount) VALUES (1, 'tunai', 5000)`
    )
    await runUp(M3)
    const con = await constraintDef('transaction_typepayment_canonical')
    expect(con.convalidated).toBe(false)
    expect(await tableCount('transaction')).toBe(1)
    await expect(
      sequelize.query(`INSERT INTO "transaction" ("order", "typePayment", amount) VALUES (2, 'tunai', 5000)`)
    ).rejects.toThrow()
    await sequelize.query(`INSERT INTO "transaction" ("order", "typePayment", amount) VALUES (2, 'CASH', 5000)`)
    expect(await tableCount('transaction')).toBe(2)
  })
})

describe('M4 deferral + actor safety (ATTR-SCHEMA-12)', () => {
  test('ATTR-SCHEMA-12: legacy NULL createdBy is not globally invalidated', async () => {
    // M4 createdBy CHECK is deliberately NOT shipped: legacy QR rows may
    // legitimately have NULL, and new-write enforcement belongs to the
    // application phase. This test locks the deferral — NULL must stay legal.
    await sequelize.query(`INSERT INTO "transaction" ("order", "typePayment", amount, "createdBy") VALUES (1, 'cash', 10000, NULL)`)
    const rows = await select(`SELECT "createdBy" FROM "transaction"`)
    expect(rows[0].createdBy).toBeNull()
  })
})

describe('M5 — closed-register snapshot (ATTR-SCHEMA-14/15)', () => {
  test('ATTR-SCHEMA-14: required closed-register snapshot fields exist', async () => {
    await runUp(M5)
    for (const col of [
      'expectedCash',
      'activeCashIn',
      'activeCashOut',
      'cashRefundsTotal',
      'refundsTotal',
      'refundCount',
      'totalTransactions',
      'closeSnapshot'
    ]) {
      expect(await columnInfo('cash_register', col)).not.toBeNull()
    }
  })

  test('ATTR-SCHEMA-15: existing register financial fields remain intact', async () => {
    await sequelize.query(
      `INSERT INTO "cash_register" (store, "user", "openingBalance", "closingBalance", "totalSales", "cashSalesReceived", "totalExpenses", status)
       VALUES (1, 1, 0, 100000, 100000, 80000, 5000, 'closed')`
    )
    await runUp(M5)
    const rows = await select(
      `SELECT "openingBalance","closingBalance","totalSales","cashSalesReceived","totalExpenses",status FROM "cash_register"`
    )
    expect(rows).toEqual([
      { openingBalance: 0, closingBalance: 100000, totalSales: 100000, cashSalesReceived: 80000, totalExpenses: 5000, status: 'closed' }
    ])
  })
})

describe('Reversibility (ATTR-SCHEMA-17)', () => {
  test('ATTR-SCHEMA-17: down paths remove only new objects and never mutate financial data', async () => {
    await sequelize.query(
      `INSERT INTO "cash_register" (store, "user") VALUES (1, 1)`
    )
    await sequelize.query(
      `INSERT INTO "transaction" ("order", "typePayment", amount, "createdBy") VALUES (1, 'cash', 10000, 9)`
    )
    await runUp(M1)
    await runUp(M2)
    await runUp(M3)
    await runUp(M5)
    await runDown(M5)
    await runDown(M3)
    await runDown(M2)
    await runDown(M1)
    expect(await columnInfo('transaction', 'cashRegisterId')).toBeNull()
    expect(await columnInfo('transaction', 'splitBillId')).toBeNull()
    expect(await columnInfo('cash_register', 'expectedCash')).toBeNull()
    expect(await constraintDef('transaction_typepayment_canonical')).toBeNull()
    expect(await tableCount('transaction')).toBe(1)
    expect(await tableCount('cash_register')).toBe(1)
    const rows = await select(`SELECT amount, "typePayment", "createdBy" FROM "transaction"`)
    expect(rows).toEqual([{ amount: '10000', typePayment: 'cash', createdBy: 9 }])
    // Restore up-state for later phases.
    await runUp(M1)
    await runUp(M2)
    await runUp(M3)
    await runUp(M5)
  })
})

describe('Model alignment', () => {
  test('transaction model exposes new attribution metadata without changing column types', async () => {
    const db = require('../db/models')
    expect(db.transaction.rawAttributes.cashRegisterId).toBeDefined()
    expect(db.transaction.rawAttributes.splitBillId).toBeDefined()
    expect(db.transaction.rawAttributes.typePayment.type.key).toBe('STRING')
    expect(db.transaction.rawAttributes.createdBy.allowNull).not.toBe(false)
  })

  test('cashRegister model exposes snapshot metadata while keeping existing fields', async () => {
    const db = require('../db/models')
    for (const attr of ['expectedCash', 'activeCashIn', 'activeCashOut', 'closeSnapshot']) {
      expect(db.cashRegister.rawAttributes[attr]).toBeDefined()
    }
    expect(db.cashRegister.rawAttributes.closingBalance).toBeDefined()
    expect(db.cashRegister.rawAttributes.totalSales).toBeDefined()
  })
})
