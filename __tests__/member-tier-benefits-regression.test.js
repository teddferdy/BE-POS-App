process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../api/index')
const db = require('../db/models')

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'secret-key-user'

// Phase 22 User-Test Blocker 3 — Empty Benefits
// Observed: "Benefits: invalid input, expected array received string" when
// Benefits left empty on Product create/edit (actually Member Tier — product
// has no benefits column; the field is member_tier.benefits JSONB).
// FE formData.perks = [{id:1,text:""}] after user clears all perks.
// Old FE code did `perks.map(...).filter(...).join("\n")` → "" (empty string)
// BE schema `z.array(...).optional().default([])` rejected "" with 400.
// Canonical empty is [] (JSONB array default), not "".
// Fix: BE preprocess coerces ""/newline-string → []/["a","b"]; FE now sends [].

let adminToken = null
let adminUser = null

beforeAll(async () => {
  adminUser = await db.user.create({
    userName: 'benefits_regression_admin_' + Date.now(),
    email: `benefits_${Date.now()}@test.com`,
    roleType: 'super_admin',
    userType: 'admin',
    store: null,
    status: 'active'
  })
  adminToken = jwt.sign(
    { id: adminUser.id, userName: adminUser.userName, roleType: 'super_admin', store: null },
    JWT_SECRET
  )
})

afterAll(async () => {
  await db.member_tier.destroy({ where: { createdBy: adminUser?.id }, force: true })
  await db.user.destroy({ where: { id: adminUser?.id }, force: true })
})

const createTier = (payload) =>
  request(app)
    .post('/member-tier/add')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(payload)

describe('Blocker 3 — Empty Benefits: empty list must not be rejected as string', () => {
  test('RED→GREEN: create with empty string benefits (FE old empty) is accepted and stored as []', async () => {
    const res = await createTier({
      name: `BENEFITS_EMPTY_STR_${Date.now()}`,
      minPoints: 0,
      maxPoints: 100,
      discountPercent: 5,
      benefits: '', // old FE empty → "" — previously 400 "expected array received string"
      status: 'active',
      color: '#f59e0b'
    })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    const tier = res.body.data
    expect(Array.isArray(tier.benefits)).toBe(true)
    expect(tier.benefits).toEqual([])
  })

  test('create with empty array benefits is accepted', async () => {
    const res = await createTier({
      name: `BENEFITS_EMPTY_ARR_${Date.now()}`,
      benefits: [],
      status: 'active'
    })
    expect(res.status).toBe(201)
    expect(res.body.data.benefits).toEqual([])
  })

  test('create with valid array benefits preserves values', async () => {
    const res = await createTier({
      name: `BENEFITS_VALID_ARR_${Date.now()}`,
      benefits: ['Free coffee', '10% off'],
      status: 'active'
    })
    expect(res.status).toBe(201)
    expect(res.body.data.benefits).toEqual(['Free coffee', '10% off'])
  })

  test('create with newline string benefits is normalized to array', async () => {
    const res = await createTier({
      name: `BENEFITS_NEWLINE_STR_${Date.now()}`,
      benefits: 'Free coffee\n10% off\n',
      status: 'active'
    })
    expect(res.status).toBe(201)
    expect(res.body.data.benefits).toEqual(['Free coffee', '10% off'])
  })

  test('create with array of {text} objects is normalized to string array', async () => {
    const res = await createTier({
      name: `BENEFITS_OBJ_ARR_${Date.now()}`,
      benefits: [{ text: 'Benefit A' }, { text: 'Benefit B' }, { text: '' }],
      status: 'active'
    })
    expect(res.status).toBe(201)
    expect(res.body.data.benefits).toEqual(['Benefit A', 'Benefit B'])
  })

  test('edit: clearing benefits sends [] and persists as []', async () => {
    const createRes = await createTier({
      name: `BENEFITS_EDIT_CLEAR_${Date.now()}`,
      benefits: ['Initial benefit'],
      status: 'active'
    })
    expect(createRes.status).toBe(201)
    const tierId = createRes.body.data.id

    const editRes = await request(app)
      .put(`/member-tier/edit/${tierId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        benefits: [] // FE after user clears all perks → [] — must not 400
      })
    expect(editRes.status).toBe(200)
    expect(editRes.body.data.benefits).toEqual([])

    const fresh = await db.member_tier.findByPk(tierId)
    expect(fresh.benefits).toEqual([])
  })

  test('edit: clearing benefits via empty string (legacy FE) also normalizes to []', async () => {
    const createRes = await createTier({
      name: `BENEFITS_EDIT_CLEAR_STR_${Date.now()}`,
      benefits: ['Initial'],
      status: 'active'
    })
    expect(createRes.status).toBe(201)
    const tierId = createRes.body.data.id

    const editRes = await request(app)
      .put(`/member-tier/edit/${tierId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ benefits: '' })
    expect(editRes.status).toBe(200)
    expect(editRes.body.data.benefits).toEqual([])
  })
})
