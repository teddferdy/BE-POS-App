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
  const exists = run('psql', [
    '-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, '-d', 'postgres',
    '-t', '-A', '-c', `SELECT 1 FROM pg_database WHERE datname = '${TEST_DB}'`
  ]).trim() === '1'

  if (!exists) {
    run('createdb', ['-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, TEST_DB])
  }

  // 2. Clone the schema from the dev DB on first use.
  const tableCount = run('psql', [
    '-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, '-d', TEST_DB,
    '-t', '-A', '-c',
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
  ]).trim()

  if (parseInt(tableCount, 10) === 0) {
    const dump = run('pg_dump', [
      '-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, '-d', SRC_DB,
      '--schema-only', '--no-owner', '--no-privileges'
    ])
    run('psql', ['-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, '-d', TEST_DB], {
      input: dump
    })
  }

  // 3. Truncate every table so each run starts from clean state.
  run('psql', [
    '-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, '-d', TEST_DB, '-c',
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
