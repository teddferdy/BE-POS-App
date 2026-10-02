process.env.NODE_ENV = 'test'

const harness = require('../scripts/rehearse-staging')
const { LOCAL_HOSTS } = require('../scripts/check-migration-preflight')

// D-05 product-grade migration, exercised against a disposable database
// (never the shared test DB, never staging, never production):
// - clean path backfills phones and creates exactly the four target objects
//   with the contract expressions/predicates
// - unparseable phones and canonical phone/name/email collisions abort
//   before any DDL or data rewrite (rows stay raw, legacy objects untouched)
// - the whole up() is one transaction (a late failure rolls back the backfill)
// - soft-deleted and GUEST-* rows do not trigger the preflight
// - superseded historical member uniqueness objects are retired if present
// - down removes only the four D-05 objects and never un-canonicalizes

const DB = `cashier_app_d05_migration_${process.pid}`
const MIGRATION = '20261012000001-d05-member-identity-uniqueness.js'

const TARGET_OBJECTS = [
  'uq_member_store_name_ci',
  'uq_member_global_name_ci',
  'uq_member_phone_e164',
  'uq_member_email_ci'
]

let sequelize = null
const qi = () => sequelize.getQueryInterface()
const runUp = () => require(`../db/migrations/${MIGRATION}`).up(qi(), require('sequelize'))
const runDown = () => require(`../db/migrations/${MIGRATION}`).down(qi(), require('sequelize'))

const MEMBER_DDL = `CREATE TABLE "member" (
  id SERIAL PRIMARY KEY,
  store INTEGER,
  name VARCHAR(255) NOT NULL,
  "phoneNumber" VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ,
  "deletedAt" TIMESTAMPTZ
)`

const select = (sql) => sequelize.query(sql, { type: sequelize.QueryTypes.SELECT })

const indexNames = async () => {
  const rows = await select(`SELECT indexname FROM pg_indexes WHERE tablename = 'member'`)
  return rows.map((r) => r.indexname)
}

const indexDefs = async () => {
  const rows = await select(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'member'`)
  return Object.fromEntries(rows.map((r) => [r.indexname, r.indexdef]))
}

const constraintNames = async () => {
  const rows = await select(
    `SELECT conname FROM pg_constraint WHERE conrelid = 'public.member'::regclass`
  )
  return rows.map((r) => r.conname)
}

const phonesById = async () => {
  const rows = await select(`SELECT "phoneNumber" FROM "member" ORDER BY id`)
  return rows.map((r) => r.phoneNumber)
}

beforeAll(async () => {
  const admin = harness.stagingConnection({ database: DB })
  // Disposable-database safety: local hosts only, never a remote target.
  if (!LOCAL_HOSTS.includes(String(admin.host || '').toLowerCase())) {
    throw new Error(`refusing D-05 migration test against non-local host "${admin.host}"`)
  }
  await harness.createDatabase(admin, DB)
  sequelize = harness.newSequelize({ ...admin, database: DB })
})

afterAll(async () => {
  if (sequelize) await sequelize.close().catch(() => {})
  sequelize = null
  await harness.dropDatabase(harness.stagingConnection({ database: DB }), DB).catch(() => {})
})

beforeEach(async () => {
  await sequelize.query('DROP TABLE IF EXISTS "member" CASCADE')
  await sequelize.query('DROP FUNCTION IF EXISTS d05_fail_second_update() CASCADE')
  await sequelize.query(MEMBER_DDL)
})

describe('D-05 migration: successful path', () => {
  test('clean path: backfills phones and creates exactly the four objects', async () => {
    await sequelize.query(
      `INSERT INTO "member" (store, name, "phoneNumber", email) VALUES
       (1, 'Toko Member', '081500000061', 'clean@example.com'),
       (NULL, 'Global Member', '+6281500000062', NULL)`
    )

    await runUp()

    const names = await indexNames()
    for (const idx of TARGET_OBJECTS) expect(names).toContain(idx)
    expect(names.filter((n) => n !== 'member_pkey').sort()).toEqual([...TARGET_OBJECTS].sort())
    expect(await phonesById()).toEqual(['+6281500000061', '+6281500000062'])
  })

  test('index definitions carry the contract expressions and predicates', async () => {
    await runUp()
    const defs = await indexDefs()

    for (const idx of TARGET_OBJECTS) expect(defs[idx]).toMatch(/^CREATE UNIQUE INDEX /)

    // name, store-scoped bucket
    expect(defs.uq_member_store_name_ci).toContain('(store, lower(TRIM(BOTH FROM name)))')
    expect(defs.uq_member_store_name_ci).toContain('(store IS NOT NULL)')
    expect(defs.uq_member_store_name_ci).toContain('("deletedAt" IS NULL)')
    // name, global bucket
    expect(defs.uq_member_global_name_ci).toContain('(lower(TRIM(BOTH FROM name)))')
    expect(defs.uq_member_global_name_ci).toContain('(store IS NULL)')
    expect(defs.uq_member_global_name_ci).toContain('("deletedAt" IS NULL)')
    // phone, global, guest-exempt (PostgreSQL renders NOT LIKE as !~~)
    expect(defs.uq_member_phone_e164).toContain('("phoneNumber")')
    expect(defs.uq_member_phone_e164).toContain('("deletedAt" IS NULL)')
    expect(defs.uq_member_phone_e164).toMatch(/\("phoneNumber"\)::text !~~ 'GUEST-%'::text/)
    expect(defs.uq_member_phone_e164).not.toMatch(/store/)
    // email, global, NULL-tolerant
    expect(defs.uq_member_email_ci).toContain('(lower(TRIM(BOTH FROM email)))')
    expect(defs.uq_member_email_ci).toContain('("deletedAt" IS NULL)')
    expect(defs.uq_member_email_ci).toContain('(email IS NOT NULL)')
    expect(defs.uq_member_email_ci).not.toMatch(/store/)
  })

  test('cross-store same name and global-vs-store same name pass the preflight', async () => {
    await sequelize.query(
      `INSERT INTO "member" (store, name, "phoneNumber") VALUES
       (1, 'Shared Name', '081500000071'),
       (2, 'shared name', '081500000072'),
       (NULL, 'Shared Name', '081500000073')`
    )

    await runUp()

    const names = await indexNames()
    for (const idx of TARGET_OBJECTS) expect(names).toContain(idx)
  })

  test('soft-deleted duplicates and guests do not trip the preflight', async () => {
    await sequelize.query(
      `INSERT INTO "member" (store, name, "phoneNumber", email, "deletedAt") VALUES
       (1, 'Retired Member', '081500000069', 'retired@example.com', NOW())`
    )
    await sequelize.query(
      `INSERT INTO "member" (store, name, "phoneNumber", email) VALUES
       (1, 'Retired Member', '081500000069', 'retired@example.com'),
       (1, 'Guest One', 'GUEST-aaa', NULL),
       (1, 'Guest Two', 'GUEST-aaa', NULL)`
    )

    await runUp()

    const names = await indexNames()
    for (const idx of TARGET_OBJECTS) expect(names).toContain(idx)
    // soft-deleted and guest rows are never rewritten
    expect(await phonesById()).toEqual(['081500000069', '+6281500000069', 'GUEST-aaa', 'GUEST-aaa'])
  })

  test('superseded historical member uniqueness objects are retired if present', async () => {
    // 20260620000004 raw global constraints + 20260913000001 C13 objects.
    await sequelize.query(`ALTER TABLE "member" ADD CONSTRAINT "uq_member_name" UNIQUE (name)`)
    await sequelize.query(`ALTER TABLE "member" ADD CONSTRAINT "uq_member_phoneNumber" UNIQUE ("phoneNumber")`)
    await sequelize.query(`ALTER TABLE "member" ADD CONSTRAINT "uq_member_email" UNIQUE (email)`)
    await sequelize.query(`ALTER TABLE "member" ADD CONSTRAINT "uq_member_store_name" UNIQUE (store, name)`)
    await sequelize.query(`CREATE UNIQUE INDEX uq_member_global_name ON "member" (name) WHERE store IS NULL`)

    await runUp()

    const constraints = await constraintNames()
    for (const legacy of ['uq_member_name', 'uq_member_phoneNumber', 'uq_member_email', 'uq_member_store_name']) {
      expect(constraints).not.toContain(legacy)
    }
    const names = await indexNames()
    expect(names).not.toContain('uq_member_global_name')
    expect(names.filter((n) => n !== 'member_pkey').sort()).toEqual([...TARGET_OBJECTS].sort())
  })

  test('a failure after the backfill rolls the whole migration back (single transaction)', async () => {
    await sequelize.query(
      `INSERT INTO "member" (store, name, "phoneNumber") VALUES
       (1, 'Tx Member One', '081500000081'),
       (1, 'Tx Member Two', '081500000082')`
    )
    // Fail the second backfill UPDATE: the first row's rewrite must roll back.
    await sequelize.query(`CREATE FUNCTION d05_fail_second_update() RETURNS trigger AS $$
      BEGIN
        IF NEW.name = 'Tx Member Two' THEN RAISE EXCEPTION 'd05 forced failure'; END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`)
    await sequelize.query(
      `CREATE TRIGGER d05_fail_second_update BEFORE UPDATE ON "member"
       FOR EACH ROW EXECUTE FUNCTION d05_fail_second_update()`
    )

    await expect(runUp()).rejects.toThrow(/d05 forced failure/)

    expect(await phonesById()).toEqual(['081500000081', '081500000082'])
    const names = await indexNames()
    for (const idx of TARGET_OBJECTS) expect(names).not.toContain(idx)
  })
})

describe('D-05 migration: fail-closed preflight (no DDL, no rewrite)', () => {
  // Every abort case carries a parseable national-form row that a backfill
  // would rewrite, plus a legacy C13 constraint that the cleanup would drop:
  // after the abort both must be exactly as they were.
  const seedSentinels = async () => {
    await sequelize.query(
      `INSERT INTO "member" (store, name, "phoneNumber") VALUES (9, 'Sentinel Member', '081500000060')`
    )
    await sequelize.query(`ALTER TABLE "member" ADD CONSTRAINT "uq_member_store_name" UNIQUE (store, name)`)
  }

  const expectUntouched = async () => {
    const names = await indexNames()
    for (const idx of TARGET_OBJECTS) expect(names).not.toContain(idx)
    expect(await constraintNames()).toContain('uq_member_store_name')
    const sentinel = await select(`SELECT "phoneNumber" FROM "member" WHERE name = 'Sentinel Member'`)
    expect(sentinel[0].phoneNumber).toBe('081500000060')
  }

  test('unparseable phone aborts', async () => {
    await seedSentinels()
    await sequelize.query(
      `INSERT INTO "member" (store, name, "phoneNumber") VALUES (1, 'Legacy Member', 'LEGACY08')`
    )

    await expect(runUp()).rejects.toThrow(/D-05 preflight abort: unparseable active phone values/)
    await expectUntouched()
  })

  test('legacy 8-character phone values abort (production expectation)', async () => {
    await seedSentinels()
    await sequelize.query(
      `INSERT INTO "member" (store, name, "phoneNumber") VALUES
       (1, 'Legacy Eight A', '12345678'),
       (1, 'Legacy Eight B', '08123456')`
    )

    await expect(runUp()).rejects.toThrow(/unparseable active phone values \(count=2\)/)
    await expectUntouched()
  })

  test('canonical phone collision aborts (national vs international form)', async () => {
    await seedSentinels()
    await sequelize.query(
      `INSERT INTO "member" (store, name, "phoneNumber") VALUES
       (1, 'Phone Holder A', '081500000064'),
       (2, 'Phone Holder B', '+6281500000064')`
    )

    await expect(runUp()).rejects.toThrow(/D-05 preflight abort: canonical phone collision groups/)
    await expectUntouched()
    const holder = await select(`SELECT "phoneNumber" FROM "member" WHERE name = 'Phone Holder A'`)
    expect(holder[0].phoneNumber).toBe('081500000064')
  })

  test('case-only name collision in one store aborts', async () => {
    await seedSentinels()
    await sequelize.query(
      `INSERT INTO "member" (store, name, "phoneNumber") VALUES
       (1, 'Case Member', '081500000065'),
       (1, 'CASE MEMBER', '081500000066')`
    )

    await expect(runUp()).rejects.toThrow(/D-05 preflight abort: canonical name collision groups/)
    await expectUntouched()
  })

  test('whitespace-only name difference in one store aborts', async () => {
    await seedSentinels()
    await sequelize.query(
      `INSERT INTO "member" (store, name, "phoneNumber") VALUES
       (1, 'Space Member', '081500000074'),
       (1, '  Space Member  ', '081500000075')`
    )

    await expect(runUp()).rejects.toThrow(/D-05 preflight abort: canonical name collision groups/)
    await expectUntouched()
  })

  test('global-bucket (store NULL) name collision aborts', async () => {
    await seedSentinels()
    await sequelize.query(
      `INSERT INTO "member" (store, name, "phoneNumber") VALUES
       (NULL, 'Global Dup', '081500000076'),
       (NULL, 'global dup', '081500000077')`
    )

    await expect(runUp()).rejects.toThrow(/D-05 preflight abort: canonical name collision groups/)
    await expectUntouched()
  })

  test('case-only email collision aborts', async () => {
    await seedSentinels()
    await sequelize.query(
      `INSERT INTO "member" (store, name, "phoneNumber", email) VALUES
       (1, 'Email Holder A', '081500000067', 'Clash@Example.com'),
       (2, 'Email Holder B', '081500000068', ' clash@example.com ')`
    )

    await expect(runUp()).rejects.toThrow(/D-05 preflight abort: canonical email collision groups/)
    await expectUntouched()
  })
})

describe('D-05 migration: down', () => {
  test('down removes only the four D-05 objects and leaves phones canonical', async () => {
    await sequelize.query(
      `INSERT INTO "member" (store, name, "phoneNumber") VALUES (1, 'Down Member', '081500000063')`
    )
    await runUp()
    await runDown()

    const names = await indexNames()
    for (const idx of TARGET_OBJECTS) expect(names).not.toContain(idx)
    expect(names).toEqual(['member_pkey'])
    // no historical object is resurrected
    expect(await constraintNames()).toEqual(['member_pkey'])
    // no un-canonicalization
    expect(await phonesById()).toEqual(['+6281500000063'])
  })
})
