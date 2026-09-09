process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const fs = require('fs')
const os = require('os')
const path = require('path')

// BACKUP_DIR is captured at module-load time in api/controller/backup.js —
// point it at a throwaway dir BEFORE the app module loads.
process.env.BACKUP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'med2-backups-'))

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// MED-2: the global backup retention schedule (which drives an unattended,
// system-wide cleanupRetention() sweep that deletes OLD BACKUPS FOR EVERY
// STORE, not just one) was settable by ANY super_admin, including a
// store-bound one whose artifact-level access (download/delete/restore) is
// already correctly restricted to their own store's backups. A store-bound
// super_admin could therefore indirectly cause deletion of another store's
// (or the global system admin's) backups by tightening the retention window,
// even though they have no direct access to those artifacts at all.
//
// Required invariant: only a GLOBAL super_admin (JWT store claim is null)
// may read or change the schedule that governs system-wide automatic
// deletion. A store-bound super_admin (JWT carries a numeric store) must be
// rejected, same as tenant roles already are.

const mkToken = (roleType, store, id) =>
  jwt.sign({ id, userName: `tok_${roleType}_${id}`, roleType, store }, JWT_SECRET)

let store1

describe('MED-2 backup schedule authorization boundary', () => {
  beforeAll(async () => {
    store1 = await db.location.create({ name: 'MED2_STORE_1', status: 'active' })
  })

  afterAll(async () => {
    await db.location.destroy({ where: { id: store1.id }, force: true })
  })

  test('store-bound super_admin CANNOT set the global retention schedule', async () => {
    const res = await request(app)
      .put('/backup/schedule')
      .set('Authorization', `Bearer ${mkToken('super_admin', store1.id, 501)}`)
      .send({ enabled: true, cron: '0 0 * * *', retention: 1 })

    expect([403, 401]).toContain(res.status)
  })

  test('store-bound super_admin CANNOT read the global retention schedule', async () => {
    const res = await request(app)
      .get('/backup/schedule')
      .set('Authorization', `Bearer ${mkToken('super_admin', store1.id, 502)}`)

    expect([403, 401]).toContain(res.status)
  })

  test('global super_admin (no store claim) CAN set the retention schedule', async () => {
    const res = await request(app)
      .put('/backup/schedule')
      .set('Authorization', `Bearer ${mkToken('super_admin', null, 503)}`)
      .send({ enabled: false, cron: '0 0 * * *', retention: 30 })

    expect(res.status).toBe(200)
  })

  test('global super_admin (no store claim) CAN read the retention schedule', async () => {
    const res = await request(app)
      .get('/backup/schedule')
      .set('Authorization', `Bearer ${mkToken('super_admin', null, 504)}`)

    expect(res.status).toBe(200)
  })

  test('tenant admin still cannot touch the schedule (pre-existing guard unaffected)', async () => {
    const res = await request(app)
      .put('/backup/schedule')
      .set('Authorization', `Bearer ${mkToken('admin', store1.id, 505)}`)
      .send({ enabled: true, cron: '0 0 * * *', retention: 1 })

    expect([403, 401]).toContain(res.status)
  })
})
