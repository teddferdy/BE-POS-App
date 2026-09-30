process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const { signSessionToken } = require('../test-helpers/authSession')
const app = require('../api/index')
const db = require('../db/models')
const { resolveRequestedLifecycleStatus } = require('../api/validation/schemas')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// HB-2 R1: store lifecycle contract hardening.
// - `status` is authoritative; a stale/legacy `isActive` must never override it.
// - absent `status` + absent `isActive` means no lifecycle transition.
// - legacy boolean `isActive` keeps its deterministic meaning (true→active,
//   false→inactive); strings must NOT be read through JS truthiness.
// - tenant authorization and terminal-state rules are unchanged (locked here).

describe('resolveRequestedLifecycleStatus mapping (pure)', () => {
  test('status="inactive" wins over legacy isActive=true', () => {
    expect(resolveRequestedLifecycleStatus({ status: 'inactive', isActive: true })).toBe('inactive')
  })

  test('status="active" wins over legacy isActive="false"', () => {
    expect(resolveRequestedLifecycleStatus({ status: 'active', isActive: 'false' })).toBe('active')
  })

  test('missing status + missing isActive means no lifecycle transition', () => {
    expect(resolveRequestedLifecycleStatus({})).toBeUndefined()
  })

  test('boolean isActive=true behaves deterministically', () => {
    expect(resolveRequestedLifecycleStatus({ isActive: true })).toBe('active')
  })

  test('boolean isActive=false behaves deterministically', () => {
    expect(resolveRequestedLifecycleStatus({ isActive: false })).toBe('inactive')
  })

  test('string "false" is passed through, never coerced to active', () => {
    expect(resolveRequestedLifecycleStatus({ isActive: 'false' })).toBe('false')
  })

  test('string "true" is passed through, never treated as authoritative', () => {
    expect(resolveRequestedLifecycleStatus({ isActive: 'true' })).toBe('true')
  })
})

describe('PUT /location/edit-location lifecycle contract (HTTP)', () => {
  let superAdminToken = null
  let superAdminUser = null
  let tenant = null

  beforeAll(async () => {
    tenant = await db.tenant.create({ code: `LOCLCC_${Date.now()}`, name: 'LOCLCC Tenant' })
    superAdminUser = await db.user.create({
      userName: `loc_lcc_admin_${Date.now()}`,
      email: `loc_lcc_${Date.now()}@test.com`,
      roleType: 'super_admin',
      userType: 'admin',
      store: null,
      status: 'active'
    })
    superAdminToken = await signSessionToken(
      { id: superAdminUser.id, userName: superAdminUser.userName, roleType: 'super_admin', store: null },
      JWT_SECRET
    )
  })

  afterAll(async () => {
    await db.location.destroy({ where: { createdBy: superAdminUser?.id }, force: true })
    await db.user.destroy({ where: { id: superAdminUser?.id }, force: true })
    await db.tenant.destroy({ where: { id: tenant?.id }, force: true })
  })

  const basePayload = (overrides = {}) => ({
    name: `LOCLCC_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    phoneNumber: '081234567890',
    email: `loclcc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@test.com`,
    address: 'Jl. Test No. 1',
    province: '31',
    city: '3171',
    district: '3171010',
    village: '3171010001',
    postalCode: '10110',
    status: 'draft',
    ...overrides
  })

  const createStore = async (overrides = {}) => {
    const res = await request(app)
      .post('/location/add-new-location')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send(basePayload(overrides))
    expect([200, 201]).toContain(res.status)
    return res.body.data
  }

  const editStore = (payload) =>
    request(app).put('/location/edit-location').set('Authorization', `Bearer ${superAdminToken}`).send(payload)

  const storedStatus = async (id) => (await db.location.findByPk(id)).status

  test('status="inactive" wins even when legacy isActive=true is present', async () => {
    const created = await createStore()
    const res = await editStore({ id: created.id, status: 'inactive', isActive: true })
    expect(res.status).toBe(200)
    expect(await storedStatus(created.id)).toBe('inactive')
  })

  test('status="active" wins even when legacy isActive="false" is present', async () => {
    const created = await createStore()
    const res = await editStore({ id: created.id, status: 'active', isActive: 'false', tenantId: tenant.id })
    expect(res.status).toBe(200)
    expect(await storedStatus(created.id)).toBe('active')
  })

  test('missing status + missing isActive means no lifecycle transition', async () => {
    const created = await createStore()
    const res = await editStore({ id: created.id, name: `${created.name} renamed` })
    expect(res.status).toBe(200)
    expect(await storedStatus(created.id)).toBe('draft')
  })

  test('string isActive="false" alone is rejected, never becomes active', async () => {
    const created = await createStore()
    const res = await editStore({ id: created.id, isActive: 'false' })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('UNKNOWN_STORE_STATUS')
    expect(await storedStatus(created.id)).toBe('draft')
  })

  test('string isActive="true" alone is rejected, never treated as authoritative', async () => {
    const created = await createStore()
    const res = await editStore({ id: created.id, isActive: 'true' })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('UNKNOWN_STORE_STATUS')
    expect(await storedStatus(created.id)).toBe('draft')
  })

  test('boolean isActive=false retains its deterministic legacy meaning', async () => {
    const created = await createStore()
    const res = await editStore({ id: created.id, isActive: false })
    expect(res.status).toBe(200)
    expect(await storedStatus(created.id)).toBe('inactive')
  })

  test('tenant authorization for operational requests is unchanged', async () => {
    const created = await createStore()
    const res = await editStore({ id: created.id, status: 'active' })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('TARGET_TENANT_REQUIRED')
    expect(await storedStatus(created.id)).toBe('draft')
  })

  test('terminal-state behavior is unchanged', async () => {
    const created = await createStore()
    await db.location.update({ status: 'retired' }, { where: { id: created.id } })
    const res = await editStore({ id: created.id, status: 'inactive' })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('STORE_STATUS_IRREVERSIBLE')
    expect(await storedStatus(created.id)).toBe('retired')
  })
})
