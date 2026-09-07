process.env.NODE_ENV = 'test'
process.env.VERCEL = 'true'

const request = require('supertest')
const app = require('../api/index')
const db = require('../db/models')

// SEC-005 — PUBLIC member lookup hardening (GET /order/customer-member).
//
// The endpoint is unauthenticated, so it must never act as a loyalty-balance
// disclosure or a member enumeration oracle:
//   * Store A and Store B must be isolated (a Store-A member is NOT returned
//     when queried against Store B).
//   * Global members (store = null) must not become a cross-tenant disclosure
//     path for their loyalty balance / tier.
//   * totalPoints / tier / discountPercent must never appear in the response.
//   * % / _ wildcard input must not let an unauthenticated caller enumerate
//     other members.

let storeA = null
let storeB = null
let tier = null
let memberA = null
let globalMember = null

beforeAll(async () => {
  storeA = await db.location.create({ name: 'SEC005_STORE_A', status: 'active' })
  storeB = await db.location.create({ name: 'SEC005_STORE_B', status: 'active' })

  tier = await db.member_tier.create({
    name: 'SEC005_GOLD',
    discountPercent: 15,
    status: 'active'
  })

  memberA = await db.member.create({
    name: 'Sec005 Member A',
    phoneNumber: '081000005001',
    store: storeA.id,
    totalPoints: 999,
    lifetimePoints: 1000,
    tier: tier.id,
    status: 'active'
  })

  // Global member: store = null, non-zero balance, meaningful tier. Under the
  // old code this leaked across tenants; it must not any more.
  globalMember = await db.member.create({
    name: 'Sec005 Global Member',
    phoneNumber: '081000005002',
    store: null,
    totalPoints: 555,
    lifetimePoints: 600,
    tier: tier.id,
    status: 'active'
  })
})

afterAll(async () => {
  await db.member.destroy({ where: { id: [memberA?.id, globalMember?.id].filter(Boolean) }, force: true })
  await db.member_tier.destroy({ where: { id: tier?.id }, force: true })
  await db.location.destroy({ where: { id: [storeA?.id, storeB?.id].filter(Boolean) }, force: true })
})

const lookup = (store, name) =>
  request(app).get('/order/customer-member').query({ store, name })

describe('SEC-005 — customer-member strict store scoping', () => {
  test('A: A Store-A member is NOT disclosed when queried against Store B', async () => {
    const res = await lookup(storeB.id, memberA.name)

    expect(res.status).toBe(200)
    // Same name, wrong store → no disclosure at all (matches under the new
    // strict contract: not found / not a member).
    expect(res.body.data).toBeNull()
  })

  test('A2: the same member IS found when queried against their own store', async () => {
    const res = await lookup(storeA.id, memberA.name)

    expect(res.status).toBe(200)
    expect(res.body.data).not.toBeNull()
    expect(res.body.data.isMember).toBe(true)
  })
})

describe('SEC-005 — global (store-null) member must not become a disclosure path', () => {
  test('B: global member loyalty balance/tier is NOT disclosed via a real store', async () => {
    const res = await lookup(storeA.id, globalMember.name)

    expect(res.status).toBe(200)
    // The global member is no longer matched by a store-specific public query
    // (strict scoping, no `store IS NULL` fallback) — so nothing is disclosed.
    expect(res.body.data).toBeNull()
  })

  test('B2: even if a global member were resolvable, the contract must not leak sensitive fields', async () => {
    // Belt-and-braces: regardless of any future matcher change, the public
    // response contract must never carry loyalty/tier data.
    const res = await lookup(storeA.id, globalMember.name)
    const bodyStr = JSON.stringify(res.body)

    expect(bodyStr).not.toContain('totalPoints')
    expect(bodyStr).not.toContain('tier')
    expect(bodyStr).not.toContain('discountPercent')
  })
})

describe('SEC-005 — safe public response contract', () => {
  test('C: valid lookup never exposes totalPoints / tier / discountPercent', async () => {
    const res = await lookup(storeA.id, memberA.name)

    expect(res.status).toBe(200)
    const data = res.body.data
    expect(data).not.toBeNull()
    expect(data.isMember).toBe(true)
    expect(data.name).toBe(memberA.name)
    expect(data).not.toHaveProperty('totalPoints')
    expect(data).not.toHaveProperty('tier')
    expect(data).not.toHaveProperty('discountPercent')
    // Response is the minimal identity-only contract.
    expect(Object.keys(data).sort()).toEqual(['id', 'isMember', 'name'])
  })
})

describe('SEC-005 — wildcard enumeration hardening', () => {
  test('D: `%` wildcard cannot match unrelated members', async () => {
    // Under the old unescaped iLike, `Sec005 %` (or any %-containing probe)
    // would match every member starting with "Sec005 "; it must now be treated
    // as a literal search that finds nobody.
    const res = await lookup(storeA.id, 'Sec005 %')

    expect(res.status).toBe(200)
    expect(res.body.data).toBeNull()
  })

  test('D2: `_` wildcard cannot match unrelated members', async () => {
    // `Sec005 Member _` would match both Member A and Global Member under an
    // unescaped iLike; it must match nobody as a literal.
    const res = await lookup(storeA.id, 'Sec005 Member _')

    expect(res.status).toBe(200)
    expect(res.body.data).toBeNull()
  })

  test('D3: a percentage-suffixed probe does not widen the match', async () => {
    // A trailing-% probe is the classic enumeration trick: `Sec005%` returning
    // results would confirm member-name boundaries. As a literal it finds
    // nothing.
    const res = await lookup(storeA.id, 'Sec005%')

    expect(res.status).toBe(200)
    expect(res.body.data).toBeNull()
  })
})

describe('SEC-005 — legitimate lookup + input validation', () => {
  test('E: normal exact name lookup works case-insensitively under the public contract', async () => {
    const res = await lookup(storeA.id, 'sec005 member a')

    expect(res.status).toBe(200)
    expect(res.body.data).not.toBeNull()
    expect(res.body.data.isMember).toBe(true)
    expect(res.body.data.id).toBe(memberA.id)
    expect(res.body.data.name).toBe(memberA.name)
  })

  test('missing name / store returns data null (compat)', async () => {
    expect((await request(app).get('/order/customer-member').query({ store: storeA.id })).status).toBe(200)
    expect((await request(app).get('/order/customer-member').query({ name: 'X' })).status).toBe(200)
  })

  test('malformed store returns a clean 400 (no 500)', async () => {
    const res = await request(app).get('/order/customer-member').query({ name: 'Sec005 Member A', store: 'not-a-number' })

    expect(res.status).toBe(400)
  })

  test('unknown name in a real store returns data null', async () => {
    const res = await lookup(storeA.id, 'No Such Sec005 Member')

    expect(res.status).toBe(200)
    expect(res.body.data).toBeNull()
  })
})