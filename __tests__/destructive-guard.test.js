'use strict'

/**
 * Phase 30F-1 — destructive-command safety guard regression tests.
 *
 * All cases use FAKE host/database values. Never point at neondb.
 * Guard refusal must happen BEFORE any DB authentication / model init.
 */

const {
  DESTRUCTIVE_CONFIRM_VALUE,
  isProductionLike,
  assertDestructiveAllowed,
  parseForceFlag
} = require('../scripts/destructive-guard')

const PROD_LIKE = {
  nodeEnv: 'production',
  host: 'ep-fake-12345.aws.neon.tech',
  database: 'neondb'
}

describe('destructive-guard helper', () => {
  test('1. production force-sync without confirmation: REFUSED', () => {
    expect(() =>
      assertDestructiveAllowed({
        operation: 'test-sync',
        ...PROD_LIKE,
        allowVar: undefined,
        hasForceFlag: true
      })
    ).toThrow(/refused/i)
  })

  test('2. production force-sync with wrong confirmation: REFUSED', () => {
    expect(() =>
      assertDestructiveAllowed({
        operation: 'test-sync',
        ...PROD_LIKE,
        allowVar: 'yes',
        hasForceFlag: true
      })
    ).toThrow(/refused/i)
  })

  test('3. production force-sync with confirmation but without --force: REFUSED', () => {
    expect(() =>
      assertDestructiveAllowed({
        operation: 'test-sync',
        ...PROD_LIKE,
        allowVar: DESTRUCTIVE_CONFIRM_VALUE,
        hasForceFlag: false
      })
    ).toThrow(/refused/i)
  })

  test('4. production with all explicit destructive conditions: gate PASSES (no DB touched)', () => {
    expect(() =>
      assertDestructiveAllowed({
        operation: 'test-sync',
        ...PROD_LIKE,
        allowVar: DESTRUCTIVE_CONFIRM_VALUE,
        hasForceFlag: true
      })
    ).not.toThrow()
  })

  test('5. production-like DB identity refuses even when NODE_ENV is not production', () => {
    expect(
      isProductionLike({
        nodeEnv: 'development',
        host: 'ep-fake-12345.aws.neon.tech',
        database: 'neondb'
      })
    ).toBe(true)
    expect(() =>
      assertDestructiveAllowed({
        operation: 'test-sync',
        nodeEnv: 'development',
        host: 'ep-fake-12345.aws.neon.tech',
        database: 'neondb',
        allowVar: undefined,
        hasForceFlag: true
      })
    ).toThrow(/refused/i)
  })

  test('6. safe local target with --force: allowed (dev workflow preserved)', () => {
    expect(
      isProductionLike({
        nodeEnv: 'development',
        host: '127.0.0.1',
        database: 'cashier_app'
      })
    ).toBe(false)
    expect(() =>
      assertDestructiveAllowed({
        operation: 'test-sync',
        nodeEnv: 'development',
        host: '127.0.0.1',
        database: 'cashier_app',
        allowVar: undefined,
        hasForceFlag: true
      })
    ).not.toThrow()
  })

  test('7. unknown NODE_ENV with unresolvable identity: FAIL CLOSED', () => {
    expect(() =>
      assertDestructiveAllowed({
        operation: 'test-sync',
        nodeEnv: undefined,
        host: undefined,
        database: undefined,
        allowVar: undefined,
        hasForceFlag: true
      })
    ).toThrow(/refused/i)
  })

  test('8. parseForceFlag detects explicit --force only', () => {
    expect(parseForceFlag(['node', 'x.js', '--force'])).toBe(true)
    expect(parseForceFlag(['node', 'x.js'])).toBe(false)
    expect(parseForceFlag([])).toBe(false)
  })

  test('9. guard error never echoes credentials', () => {
    let message = ''
    try {
      assertDestructiveAllowed({
        operation: 'test-sync',
        ...PROD_LIKE,
        allowVar: 'wrong-secret-value-123',
        hasForceFlag: true
      })
    } catch (e) {
      message = e.message
    }
    expect(message).toMatch(/refused/i)
    expect(message).not.toContain('wrong-secret-value-123')
    expect(message).not.toContain('ep-fake-12345')
  })
})

describe('destructive script entry points refuse before DB work', () => {
  const { spawnSync } = require('child_process')
  const path = require('path')

  const runScript = (rel, envExtra = {}, args = []) => {
    // Isolated env: fake prod-like values, never real credentials.
    const res = spawnSync('node', [path.join(__dirname, '..', rel), ...args], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        POSTGRES_HOST: 'ep-fake-12345.aws.neon.tech',
        POSTGRES_DATABASE: 'neondb',
        POSTGRES_USER: 'fake-user',
        POSTGRES_PASSWORD: 'fake-password',
        DB_DEV_HOST: '127.0.0.1',
        DB_DEV_PORT: '5432',
        DB_DEV_USERNAME: 'postgres',
        DB_DEV_PASSWORD: 'fake-local',
        DB_DEV_DATABASE: 'cashier_app',
        ...envExtra
      }
    })
    return {
      status: res.status,
      out: `${res.stdout || ''}${res.stderr || ''}`
    }
  }

  test('5/6. migrate.js production without opt-in REFUSES before DB auth', () => {
    const r = runScript('scripts/migrate.js')
    expect(r.status).not.toBe(0)
    expect(r.out).toMatch(/refused/i)
    expect(r.out).not.toMatch(/Connected!/)
    expect(r.out).not.toMatch(/Schema sync completed/)
  })

  test('migrate.js production with confirmation but no --force REFUSES', () => {
    const r = runScript(
      'scripts/migrate.js',
      { ALLOW_DESTRUCTIVE_SYNC: DESTRUCTIVE_CONFIRM_VALUE },
      []
    )
    expect(r.status).not.toBe(0)
    expect(r.out).toMatch(/refused/i)
  })

  test('6. sync-db-prod production REFUSES before destructive SQL', () => {
    const r = runScript('scripts/sync-db-prod.js')
    expect(r.status).not.toBe(0)
    expect(r.out).toMatch(/refused/i)
    expect(r.out).not.toMatch(/PROD database connected/)
    expect(r.out).not.toMatch(/TRUNCATE/)
  })

  test('7. sync-user-prod production REFUSES before destructive SQL', () => {
    const r = runScript('scripts/sync-user-prod.js')
    expect(r.status).not.toBe(0)
    expect(r.out).toMatch(/refused/i)
    expect(r.out).not.toMatch(/PROD database connected/)
  })

  test('8. reset-data production REFUSES before TRUNCATE', () => {
    const r = runScript('scripts/reset-data.js')
    expect(r.status).not.toBe(0)
    expect(r.out).toMatch(/refused/i)
    expect(r.out).not.toMatch(/Truncating transactional tables/)
  })
})

describe('CI static safety check', () => {
  const { spawnSync } = require('child_process')
  const fs = require('fs')
  const os = require('os')
  const path = require('path')

  test('9. static check flags an intentionally dangerous fixture', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'force-sync-fixture-'))
    const fixture = path.join(dir, 'danger.js')
    fs.writeFileSync(
      fixture,
      'const x = 1\nawait db.sequelize.sync({ force: true })\n'
    )
    const checker = path.join(__dirname, '..', 'scripts', 'check-no-force-sync.js')
    const res = spawnSync('node', [checker, `--scan-dir=${dir}`], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    })
    const out = `${res.stdout || ''}${res.stderr || ''}`
    fs.rmSync(dir, { recursive: true, force: true })
    expect(res.status).not.toBe(0)
    expect(out).toMatch(/danger\.js/)
    expect(out).toMatch(/sync\s*\(\s*\{\s*force/)
  })
})
