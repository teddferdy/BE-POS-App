'use strict'

// AUTH-1 development/test bootstrap for the tenant foundation.
//
// Assigns existing tenant-less stores and legacy users into a single
// explicitly-marked "default" tenant so local development can exercise the
// new authorization layer. This is a DEV-ONLY convenience strategy — it must
// NEVER run against production: tenant ownership of real business data
// requires an explicit business decision (see the AUTH-1 report), and this
// script refuses to run when NODE_ENV=production or production-adjacent
// DATABASE_URL-style env vars are present.
//
// Mapping (fail-safe narrow, see utils/authContext.js LEGACY_ROLE_MAP):
//   super_admin → platform alias (no membership needed; skipped)
//   admin       → store_admin membership + assignment to the user's store
//   kasir       → cashier membership (+ assignment where a store is set)
//   user        → staff membership (+ assignment where a store is set)
// Idempotent: re-runs only fill gaps, never duplicate or rewrite.

if (process.env.NODE_ENV === 'production') {
  console.error('[bootstrap-tenant-foundation] REFUSED: will not run with NODE_ENV=production')
  process.exit(1)
}
for (const v of ['POSTGRES_URL', 'DATABASE_URL', 'NEON_DATABASE_URL']) {
  if (process.env[v]) {
    console.error(`[bootstrap-tenant-foundation] REFUSED: ${v} is set (production-adjacent)`)
    process.exit(1)
  }
}

const db = require('../db/models')
const { legacyRoleTypeToTarget } = require('../utils/authContext')

const run = async () => {
  const [tenant] = await db.tenant.findOrCreate({
    where: { code: 'default' },
    defaults: { code: 'default', name: 'Default Tenant (bootstrap — not a production boundary)' }
  })
  console.log(`[bootstrap-tenant-foundation] tenant default id=${tenant.id}`)

  const orphanStores = await db.location.findAll({ where: { tenantId: null } })
  for (const store of orphanStores) {
    await store.update({ tenantId: tenant.id })
    console.log(`[bootstrap-tenant-foundation] store ${store.id} → tenant ${tenant.id}`)
  }

  const users = await db.user.findAll({ attributes: ['id', 'roleType', 'store', 'status'] })
  for (const user of users) {
    const target = legacyRoleTypeToTarget(user.roleType)
    if (target === 'platform_admin') {
      console.log(`[bootstrap-tenant-foundation] user ${user.id} (${user.roleType}): platform alias, no membership`)
      continue
    }
    const [membership, created] = await db.tenantMembership.findOrCreate({
      where: { userId: user.id, tenantId: tenant.id },
      defaults: { userId: user.id, tenantId: tenant.id, role: target, status: 'ACTIVE' }
    })
    console.log(
      `[bootstrap-tenant-foundation] user ${user.id}: membership ${membership.role}/${membership.status} ${created ? '(created)' : '(exists)'}`
    )
    if (user.store != null) {
      const store = await db.location.findByPk(user.store, { attributes: ['id', 'tenantId'] })
      if (store && Number(store.tenantId) === Number(tenant.id)) {
        await db.storeAssignment.findOrCreate({
          where: { userId: user.id, storeId: store.id },
          defaults: { userId: user.id, tenantId: tenant.id, storeId: store.id }
        })
        console.log(`[bootstrap-tenant-foundation] user ${user.id}: assigned store ${store.id}`)
      }
    }
  }

  await db.sequelize.close()
  console.log('[bootstrap-tenant-foundation] done')
}

run().catch((err) => {
  console.error('[bootstrap-tenant-foundation] FAILED:', err.message)
  process.exit(1)
})
