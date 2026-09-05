'use strict'
const { Op } = require('sequelize')

// Query-level tenant guard, complementing (not replacing) storeValidation's
// validateStoreAccess. That middleware only checks which store value a
// caller is ALLOWED TO CLAIM in the request body/query — it never looks at
// the record a controller goes on to fetch, so `Model.findByPk(id)` followed
// by an update/destroy was reachable across tenants regardless of the
// middleware. These helpers push the tenant condition into the WHERE clause
// itself so the database can never return, update, or delete another
// tenant's row in the first place — same principle already used correctly
// in salesReturn.js and purchasePayment.apDashboard.
//
// Two shapes exist in this schema and must not be conflated:
//   - scalarStoreScope: `store` is a single INTEGER column (one row belongs
//     to exactly one store) — e.g. purchase_payment, delivery_order.
//   - arrayStoreScope: `store` is a JSONB array of store IDs (one row can be
//     shared across multiple stores) — e.g. queue, promo_campaign. Matches
//     the Op.contains convention their own list/apply endpoints already use.

const isSuperAdmin = (req) => req.user?.roleType === 'super_admin'

// super_admin: unrestricted, same as before this fix (explicit product
// behavior — see PANDUAN-SUPER-ADMIN.md / requireRole('super_admin', ...)
// usage across routes).
// Everyone else: merged into WHERE so a non-owning row is indistinguishable
// from a non-existent one (404, not 403 — see callers).
// Fails closed: a non-super-admin token without a numeric `store` claim
// matches an impossible value instead of silently matching every row.
function scalarStoreScope(req, where = {}) {
  if (isSuperAdmin(req)) return { ...where }
  const userStore = Number(req.user?.store)
  return { ...where, store: Number.isFinite(userStore) ? userStore : -1 }
}

// IMPORTANT: despite the JSONB column type, `store` on these models is in
// practice written as a bare scalar (`strToNum()`/`strToNumNullable()` in
// validation/schemas.js feed createCampaign/createQueue a single number or
// null, never an array), verified against a real Postgres instance:
//   store: 5            -> Op.contains: [5]  does NOT match (false)
//                       -> store: 5 (scalar eq) DOES match
// The Op.contains convention already used by getCampaigns/getQueueList
// elsewhere in these files therefore does not match real rows created
// through the normal create endpoint — a pre-existing bug, out of scope
// here (see final report). This helper matches BOTH shapes so it neither
// inherits that bug nor breaks in the event a row ever does hold a real
// array (multi-store assignment), without needing a data migration to land
// this security fix.
function arrayStoreScope(req, where = {}) {
  if (isSuperAdmin(req)) return { ...where }
  const userStore = Number(req.user?.store)
  if (!Number.isFinite(userStore)) {
    return { ...where, store: { [Op.contains]: [-1] } }
  }
  return {
    ...where,
    [Op.or]: [
      { store: userStore },
      { store: { [Op.contains]: [userStore] } }
    ]
  }
}

// A third shape, distinct from both of the above: `store` is a JSONB
// column that genuinely holds an array in practice (verified empirically
// against a real Postgres instance for both models below — unlike
// promo_campaign/queue, whose JSONB column holds a bare scalar in
// practice), AND an unassigned row (`store: null` or `store: []`) is
// treated as visible to every store, not just super_admin — verified
// against each model's own existing list endpoint, not invented here:
//   - supplier: supplier.js's create/update genuinely write an array
//     every time (`Array.isArray(body.store) ? body.store :
//     [Number(user.store)]`); its own list query already does
//     `[{store:null},{store:{Op.contains:[id]}},store='[]'::jsonb]` for
//     non-super-admin.
//   - driver: delivery.js's getDrivers list endpoint uses the identical
//     null/[]/Op.contains OR-clause for non-super-admin.
// Named generically (not "supplierStoreWhere") because it is not
// supplier-specific — reuse it for any model matching this exact shape
// rather than duplicating the same three-branch OR elsewhere.
function nullableArrayStoreWhere(storeId) {
  return {
    [Op.or]: [
      { store: null },
      { store: { [Op.eq]: [] } },
      { store: { [Op.contains]: [storeId] } }
    ]
  }
}

function nullableArrayStoreScope(req, where = {}) {
  if (isSuperAdmin(req)) return { ...where }
  const userStore = Number(req.user?.store)
  const storeId = Number.isFinite(userStore) ? userStore : -1
  return { ...where, ...nullableArrayStoreWhere(storeId) }
}

// Kept as an alias — existing call sites (supplierBankAccount.js,
// supplierContact.js) were written against this name before the shape
// was confirmed to be shared by other models (e.g. driver); no need to
// churn those call sites just to rename.
const supplierStoreScope = nullableArrayStoreScope

// Relation-based ownership: for a model that has NO store column of its
// own and is owned only through a parent it belongsTo (e.g.
// supplier_bank_account/supplier_contact -> supplier.store), this builds
// the Sequelize `include` entry that makes the JOIN itself the tenant
// guard — `required: true` turns the include into an inner join, so a
// child row whose parent belongs to another store is excluded from the
// result set entirely rather than merely hidden by application code.
// Kept deliberately separate from scalarStoreScope/arrayStoreScope: this
// is a different mechanism (a join condition, not a WHERE on the model's
// own column) and conflating the two would make both harder to reason
// about.
//
// `parentShape` selects which ownership shape the PARENT model uses:
//   'scalar'        (default) — parent has a single INTEGER `store` column.
//   'nullableArray' — parent's `store` is a JSONB array with the
//                     null/empty-array-is-global convention (supplier,
//                     driver). 'supplier' is accepted as an alias for the
//                     same behavior — kept for the two existing call sites.
function relatedStoreInclude(req, { model, as, attributes, parentShape = 'scalar' }) {
  if (isSuperAdmin(req)) {
    return { model, as, required: false, ...(attributes ? { attributes } : {}) }
  }
  const userStore = Number(req.user?.store)
  const storeId = Number.isFinite(userStore) ? userStore : -1
  const where =
    parentShape === 'supplier' || parentShape === 'nullableArray'
      ? nullableArrayStoreWhere(storeId)
      : { store: storeId }
  return {
    model,
    as,
    required: true,
    where,
    ...(attributes ? { attributes } : {})
  }
}

module.exports = {
  isSuperAdmin,
  scalarStoreScope,
  arrayStoreScope,
  supplierStoreScope,
  nullableArrayStoreScope,
  relatedStoreInclude
}
