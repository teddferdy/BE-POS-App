/**
 * Jest globalSetup for the isolated test database.
 *
 * The migration files only contain incremental 2026+ changes, so the test DB
 * cannot be bootstrapped with `sequelize-cli db:migrate`. Instead the schema is
 * cloned from the dev DB (`pg_dump --schema-only`), then every table is
 * truncated before each run so tests always start from deterministic, empty
 * state and never touch real data.
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
