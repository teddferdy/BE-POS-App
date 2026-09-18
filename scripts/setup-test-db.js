/**
 * Jest globalSetup for the isolated test database.
 *
 * The migration files only contain incremental 2026+ changes, so the test DB
 * cannot be bootstrapped with `sequelize-cli db:migrate`. Instead the schema is
 * cloned from the dev DB (`pg_dump --schema-only`), then every table is
 * truncated before each run so tests always start from deterministic, empty
 * state and never touch real data.
 *
 * Phase 33 R-4 contract: after provisioning, the test database holds the
 * complete required schema BEFORE any test connects through db/models, so
 * tests never depend on the runtime afterConnect auto-patch
 * (db/models/index.js) to repair missing tables/columns/indexes. Step 3b
 * below explicitly provisions every object previously owned only by runtime
 * (R-1 tables, R-2 columns, R-3 deviceId/index) with idempotent guarded DDL,
 * and step 3c verifies the full contract from PostgreSQL catalogs, failing
 * loudly before tests start when anything is still missing. The runtime
 * auto-patch itself is intentionally left untouched (R-5 removes it later).
 */
const { spawnSync } = require('child_process')

const DB_HOST = process.env.DB_DEV_HOST || '127.0.0.1'
const DB_PORT = process.env.DB_DEV_PORT || '5432'
const DB_USER = process.env.DB_DEV_USERNAME || 'postgres'
const DB_PASS = process.env.DB_DEV_PASSWORD
const SRC_DB = process.env.DB_DEV_DATABASE || 'cashier_app'
const TEST_DB = process.env.DB_TEST_DATABASE || 'cashier_app_test'

const run = (cmd, args, opts = {}) => {
  const res = spawnSync(cmd, args, {
    env: { ...process.env, PGPASSWORD: DB_PASS },
    encoding: 'utf8',
    ...opts
  })
  if (res.status !== 0) {
    throw new Error(`${cmd} failed: ${res.stderr || res.stdout}`)
  }
  return res.stdout
}

module.exports = async () => {
  // 1. Create the test database if it does not exist yet.
  const exists =
    run('psql', [
      '-h',
      DB_HOST,
      '-p',
      DB_PORT,
      '-U',
      DB_USER,
      '-d',
      'postgres',
      '-t',
      '-A',
      '-c',
      `SELECT 1 FROM pg_database WHERE datname = '${TEST_DB}'`
    ]).trim() === '1'

  if (!exists) {
    run('createdb', ['-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, TEST_DB])
  }

  // 2. Clone the schema from the dev DB on first use.
  const tableCount = run('psql', [
    '-h',
    DB_HOST,
    '-p',
    DB_PORT,
    '-U',
    DB_USER,
    '-d',
    TEST_DB,
    '-t',
    '-A',
    '-c',
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
  ]).trim()

  if (parseInt(tableCount, 10) === 0) {
    const dump = run('pg_dump', [
      '-h',
      DB_HOST,
      '-p',
      DB_PORT,
      '-U',
      DB_USER,
      '-d',
      SRC_DB,
      '--schema-only',
      '--no-owner',
      '--no-privileges'
    ])
    run('psql', ['-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, '-d', TEST_DB], {
      input: dump
    })
  }

  // 3. Ensure store-scoped member constraints exist even when dev-schema.sql is stale.
  // CI clones the dev DB from a committed dev-schema.sql snapshot; if that snapshot
  // predates C13 (20260913000001), the test DB would otherwise miss uq_member_store_name
  // and uq_member_global_name, causing the DB-level C13 test to pass locally (where the
  // developer's test DB was already migrated) but fail in a fresh CI clone.
  // The explicit SQL below idempotently guarantees the two C13 objects.
  // The old global constraint uq_member_name (20260620000004) is removed if present to
  // match the migration's intended final state; the new composite and partial index are
  // created if missing. All statements are guarded so re-runs are safe.
  try {
    run('psql', [
      '-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, '-d', TEST_DB,
      '-c', `DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_member_name' AND conrelid = 'public.member'::regclass) THEN
          ALTER TABLE "member" DROP CONSTRAINT uq_member_name;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL; END $$;`
    ])
  } catch {}
  try {
    run('psql', [
      '-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, '-d', TEST_DB,
      '-c', `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_member_store_name' AND conrelid = 'public.member'::regclass) THEN
          ALTER TABLE "member" ADD CONSTRAINT uq_member_store_name UNIQUE (store, name);
        END IF;
      EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL; END $$;`
    ])
  } catch {}
  try {
    run('psql', [
      '-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, '-d', TEST_DB,
      '-c', `CREATE UNIQUE INDEX IF NOT EXISTS uq_member_global_name ON "member" (name) WHERE store IS NULL`
    ])
  } catch {}

  // 3b. Phase 33 R-4: explicitly provision every schema object previously
  // owned only by the runtime afterConnect auto-patch (db/models/index.js),
  // so tests never depend on runtime schema repair. All statements are
  // guarded (IF NOT EXISTS) and therefore safe to re-run; pre-existing
  // objects and their data are never touched. Column/table definitions match
  // the R-1/R-2 migrations, the current models, and scripts/dev-schema.sql.
  // NOTE: CREATE TABLE shells intentionally carry no FK constraints, matching
  // the R-1 migration contract (FKs exist on snapshot-derived databases via
  // the snapshot itself; a migrated-only database likewise has none).
  const psqlTest = (sql) =>
    run('psql', ['-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, '-d', TEST_DB, '-c', sql])

  const R4_TABLE_DDL = [
    `CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      "userId" integer NOT NULL,
      store integer,
      "shiftId" integer,
      type character varying(20) DEFAULT 'check-in',
      "absenAt" timestamp with time zone,
      latitude double precision,
      longitude double precision,
      accuracy double precision,
      algorithm character varying(20) DEFAULT 'gps',
      status character varying(20) DEFAULT 'valid',
      note character varying(255),
      "createdBy" integer,
      "modifiedBy" integer,
      "createdAt" timestamp with time zone NOT NULL,
      "updatedAt" timestamp with time zone NOT NULL,
      "deletedAt" timestamp with time zone
    )`,
    `CREATE TABLE IF NOT EXISTS overtime (
      id SERIAL PRIMARY KEY,
      store integer,
      shift_id integer NOT NULL,
      employee_id integer NOT NULL,
      date date NOT NULL,
      start_time time without time zone NOT NULL,
      end_time time without time zone NOT NULL,
      duration_hours numeric(10,2) DEFAULT 0 NOT NULL,
      note text,
      status character varying(20) DEFAULT 'pending',
      "decidedBy" integer,
      "decidedAt" timestamp with time zone,
      status_history jsonb DEFAULT '[]'::jsonb,
      accounting_status character varying(20) DEFAULT 'unposted',
      "postedAt" timestamp with time zone,
      "journalId" integer,
      "createdBy" integer,
      "modifiedBy" integer,
      "createdAt" timestamp with time zone NOT NULL,
      "updatedAt" timestamp with time zone NOT NULL,
      "deletedAt" timestamp with time zone
    )`
  ]

  // [table, column, definition] — R-2 runtime-only columns (12) plus the R-3
  // deviceId column so stale dev clones converge without runtime repair.
  // Monetary types follow the current model/BIGINT contract, not the stale
  // runtime INTEGER patch (see 20261003000003 header).
  const R4_COLUMNS = [
    ['purchase_order', 'additionalCost', 'BIGINT DEFAULT 0'],
    ['purchase_order', 'overDeliveryTolerance', 'INTEGER DEFAULT 10'],
    ['purchase_order_item', 'conversionToBase', 'DECIMAL(10,4) DEFAULT 1'],
    ['goods_receipt_item', 'costPrice', 'BIGINT DEFAULT 0'],
    ['goods_receipt_item', 'landedCost', 'BIGINT DEFAULT 0'],
    ['goods_receipt_item', 'conversionToBase', 'DECIMAL(10,4) DEFAULT 1'],
    ['goods_receipt_item', 'qtyStock', 'DECIMAL(12,2) DEFAULT 0'],
    ['transaction', 'salesReturnId', 'INTEGER'],
    ['shift_swap', 'status_history', `JSONB DEFAULT '[]'::jsonb`],
    ['shift_swap', 'expires_at', 'TIMESTAMP'],
    ['user', 'overtimeRate', 'DECIMAL(15,2) DEFAULT 0'],
    ['user', 'overtimeFactor', 'DECIMAL(10,2) DEFAULT 1.5'],
    ['product_review', 'deviceId', 'VARCHAR(64)']
  ]

  const R4_INDEXES = [
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_product_review_device ON "product_review" ("productId", "deviceId") WHERE "deviceId" IS NOT NULL`
  ]

  for (const ddl of R4_TABLE_DDL) {
    try {
      psqlTest(ddl)
    } catch {}
  }
  for (const [table, column, definition] of R4_COLUMNS) {
    try {
      psqlTest(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${definition}`)
    } catch {}
  }
  for (const ddl of R4_INDEXES) {
    try {
      psqlTest(ddl)
    } catch {}
  }

  // 3c. Phase 33 R-4: verify the full schema contract from PostgreSQL
  // catalogs BEFORE tests run. Any gap fails loudly here instead of being
  // silently repaired by afterConnect later. This is the R-4 guarantee.
  const R4_REQUIRED_TABLES = [
    'attendance',
    'overtime',
    'purchase_order',
    'purchase_order_item',
    'goods_receipt_item',
    'transaction',
    'shift_swap',
    'user',
    'product_review'
  ]
  const missingTables = []
  for (const table of R4_REQUIRED_TABLES) {
    const out = run('psql', [
      '-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, '-d', TEST_DB,
      '-t', '-A', '-c',
      `SELECT to_regclass('public.${table}') IS NOT NULL`
    ]).trim()
    if (out !== 't') missingTables.push(table)
  }
  const missingColumns = []
  for (const [table, column] of R4_COLUMNS.map(([t, c]) => [t, c])) {
    if (missingTables.includes(table)) continue
    const out = run('psql', [
      '-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, '-d', TEST_DB,
      '-t', '-A', '-c',
      `SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}'`
    ]).trim()
    if (out !== '1') missingColumns.push(`${table}.${column}`)
  }
  // R-1 table shells: every model column must exist, not just the table.
  const R4_TABLE_COLUMNS = {
    attendance: ['id', 'userId', 'store', 'shiftId', 'type', 'absenAt', 'latitude', 'longitude', 'accuracy', 'algorithm', 'status', 'note', 'createdBy', 'modifiedBy', 'createdAt', 'updatedAt', 'deletedAt'],
    overtime: ['id', 'store', 'shift_id', 'employee_id', 'date', 'start_time', 'end_time', 'duration_hours', 'note', 'status', 'decidedBy', 'decidedAt', 'status_history', 'accounting_status', 'postedAt', 'journalId', 'createdBy', 'modifiedBy', 'createdAt', 'updatedAt', 'deletedAt']
  }
  for (const [table, cols] of Object.entries(R4_TABLE_COLUMNS)) {
    if (missingTables.includes(table)) continue
    const out = run('psql', [
      '-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, '-d', TEST_DB,
      '-t', '-A', '-c',
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}'`
    ])
    const existing = new Set(out.split('\n').map((s) => s.trim()).filter(Boolean))
    for (const col of cols) {
      if (!existing.has(col)) missingColumns.push(`${table}.${col}`)
    }
  }
  const missingIndexes = []
  const idxCount = run('psql', [
    '-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, '-d', TEST_DB,
    '-t', '-A', '-c',
    `SELECT count(*) FROM pg_indexes WHERE indexname = 'uq_product_review_device'`
  ]).trim()
  if (idxCount !== '1') missingIndexes.push('uq_product_review_device')
  const problems = [...missingTables.map((t) => `table ${t}`), ...missingColumns.map((c) => `column ${c}`), ...missingIndexes.map((i) => `index ${i}`)]
  if (problems.length > 0) {
    throw new Error(
      `[setup-test-db] R-4 schema contract FAILED — test DB ${TEST_DB} is missing required schema and must not run tests: ${problems.join(', ')}. ` +
        `The test schema source (dev DB ${SRC_DB} / snapshot) needs reconciliation; runtime afterConnect must not be relied on to repair this.`
    )
  }

  // 4. Truncate every table so each run starts from clean state.
  run('psql', [
    '-h',
    DB_HOST,
    '-p',
    DB_PORT,
    '-U',
    DB_USER,
    '-d',
    TEST_DB,
    '-c',
    `DO $$
     DECLARE r RECORD;
     BEGIN
       FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
         EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
       END LOOP;
     END $$;`
  ])

  console.log(`[setup-test-db] test DB ready: ${TEST_DB}`)
}
