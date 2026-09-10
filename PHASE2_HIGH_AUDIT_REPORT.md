# Phase 2 HIGH Security Read-Only Audit

Independent adversarial verification of HIGH-1..HIGH-9 from `SECURITY_AUDIT_REPORT.md`.
Read-only audit — no source, route, config, schema, or test modifications were made.
Scope strictly limited to HIGH-1..9; LOW/MEDIUM findings were not expanded.

## Executive Verdict

**READY FOR HIGH REMEDIATION**

All 9 HIGH findings were independently traced to the final database query. 9/9 are
**CONFIRMED** (CONFIRMED: 9, FALSE POSITIVE: 0, MITIGATED: 0, DUPLICATE: 0). The
attack surface, pre-conditions, and root causes are precisely characterized below,
and a consistent remediation pattern already exists in-tree (`utils/tenantScope.js`)
that is applied to other controllers but not to these 9. Remediation can proceed
without reassessment.

## Finding Summary

| Finding | Status | Severity | Exploitable | Evidence |
|---|---|---|---|---|
| HIGH-1 reporting.js cookie-store trust | CONFIRMED | HIGH | Yes (any authenticated role) | `reporting.js:8` reads `req.cookies?.store \|\| req.user?.store`; `validateStoreAccess` never inspects cookies |
| HIGH-2 getKitchenOrders fail-open | CONFIRMED | HIGH | Yes (any authenticated role, omit `?store`) | `order.js:2629` `whereClause = store ? { store } : {}`; multi-store kitchen orders confirmed in DB |
| HIGH-3 updateOrderItemStatus zero tenant check | CONFIRMED | HIGH (write) | Yes (authenticated staff) | `order.js:2579` `OrderItem.findOne({ where: { id, order } })`, no store join |
| HIGH-4 stockHistory.getByProduct all-store | CONFIRMED | HIGH | Yes (authenticated staff, guess `productId`) | `stockHistory.js` `where: { product: productId }` despite `stock_history.store` column; multi-store rows in DB |
| HIGH-5 inventory.js getStoreId unvalidated input | CONFIRMED | HIGH | Yes (authenticated staff, `?storeId` / cookie) | `inventory.js:7` reads `query.storeId\|query.store\|cookies.store`; middleware blind to `query.storeId`; fail-open `where={}` paths |
| HIGH-6 Socket.IO no auth | CONFIRMED | HIGH | Yes (unauthenticated) | `socket.js` `join-kitchen`/`join-store` accept any `storeId`, no handshake auth |
| HIGH-7 product.js stores-array bypass + cookie/body fallbacks | CONFIRMED | HIGH (write) | Yes (admin role) | `product.js:669-782` arbitrary `stores` array → `syncProductStores`; `product.js:1039` cookie/body storeId drives per-store stock writes |
| HIGH-8 accountsReceivable.create foreign-store order join | CONFIRMED | HIGH | Yes (authenticated staff) | `accountsReceivable.js:154` `db.order.findByPk(orderId)` with no store match |
| HIGH-9 purchaseReturn.getAll cookie trust + fail-open | CONFIRMED | HIGH | Yes (any authenticated role) | `purchaseReturn.js:66-68` cookie-driven `effectiveStore`, `where={}` when absent |

# Detailed Findings

## HIGH-1 — reporting.js trusts unvalidated `req.cookies.store`

- **Verdict:** CONFIRMED
- **Severity:** HIGH
- **Affected Endpoint:** `GET /report/sales-summary`, `/report/product-sales`, `/report/category-sales`, `/report/kasir-performance` (`api/routes/reporting.js`)
- **Affected Roles:** any role passing `authorization` (no `requireRole` on these routes) with JWT claim `store = S`
- **Affected Tenant Scope:** read of another store's sales/product/category/KPI report rows
- **Attack Surface:** HTTP cookie `store`
- **Root Cause:** `api/controller/reporting.js:8` — `const userStore = req.cookies?.store || req.user?.store`; `:10` — `effectiveStore = store(query) || userStore`. The controller ignores `req.storeId` (the value pinned by `validateStoreAccess`) and instead prefers an attacker-controlled cookie over the JWT claim. `utils/storeValidation.js` derives `requestedStore` from `req.query.store` / `req.body.store` / `req.body.storeId` only — **never from cookies**.
- **Request Flow:** `authorization` → `validateStoreAccess` (tenant claim mismatch with `?store` → 403; no query param → `req.storeId = user.store`, pass) → controller reads `req.cookies.store`, which is unvalidated.
- **Attacker-Controlled Input:** `Cookie: store=<otherStoreId>`.
- **Why It Is Exploitable:** A tenant of store 1 sends `GET /report/sales-summary` with **no** `?store` param (middleware passes) plus `Cookie: store=6`. `effectiveStore = 6`, and `where = { store: 6 }` returns store 6's sales summary. The query-param variant is blocked by the middleware, but the cookie variant bypasses it entirely; verified the middleware code path and confirmed cookies are never read there.
- **Reproduction:** Authenticate as any staff user (`store:1`); call `/report/sales-summary` with `Cookie: store=6`. Response contains store 6 revenue rows. Same pattern at lines 54, 100, 146.
- **Existing Mitigation:** `validateStoreAccess` blocks a *query* `?store` mismatch (403) for tenant roles. No cookie validation exists. sales-summary `where` is store-filtered (unlike HIGH-2) — only the value source is wrong.
- **Recommended Remediation:** Replace lines 8/10 with `req.storeId ?? req.user?.store`; reject or ignore `req.cookies.store` for tenant roles; add `scalarStoreScope` before the `where` in each of the four controllers.
- **Regression Risk:** LOW (behavioral change only in the value source; same-store behavior preserved).

## HIGH-2 — getKitchenOrders fail-open on missing store

- **Verdict:** CONFIRMED
- **Severity:** HIGH
- **Affected Endpoint:** `GET /order/kitchen` (`api/routes/order.js:68-73`)
- **Affected Roles:** any role passing `authorization` (no `requireRole`)
- **Affected Tenant Scope:** read of ALL stores' kitchen orders
- **Attack Surface:** omitted `?store` query param
- **Root Cause:** `api/controller/order.js:2629` — `const whereClause = store ? { store } : {}` where `store` is `req.query.store` (line 2624). No fallback to `req.storeId`; an absent/blank param → `{}` → `Order.findAll` across every store.
- **Request Flow:** tenant `?store=<own>` → middleware pass, controller filters own store (OK). Tenant omits `?store` → middleware pass (`req.storeId = user.store`) → controller **ignores** `req.storeId` → `where = {}` → all stores. Super admin `?store` = intended global access (not a finding).
- **Attacker-Controlled Input:** absence of `?store`; conversely `?store=<foreign>` is *already* 403'd by middleware for tenant roles (this part is safe).
- **Why It Is Exploitable:** DB-verified: `order` has store 1 (`pending` 6, `cancelled` 2, `served` 56) and store 6 (`served` 3); `enum_order_status` includes `preparing`/`ready` (kitchen states). A store-1 staff caller with no `?store` receives store 6 kitchen/active orders (order numbers, items, per-item status, customer metadata via `getOrderAttributes`).
- **Reproduction:** Authenticate as store-1 staff; `GET /order/kitchen` with no store param → orders from stores 1 and 6.
- **Existing Mitigation:** `validateStoreAccess` blocks cross-store `?store` claims for tenant roles; no mitigation for the no-param path.
- **Recommended Remediation:** `const store = req.storeId ?? req.query.store`; when `store` is absent for a non-super-admin, filter to empty (or 404) — never `{}`. Apply `scalarStoreScope`.
- **Regression Risk:** LOW.

## HIGH-3 — updateOrderItemStatus zero tenant check

- **Verdict:** CONFIRMED
- **Severity:** HIGH (cross-tenant write)
- **Affected Endpoint:** `PUT /order/update-item-status` (`api/routes/order.js:81-87`, `validate(updateOrderItemStatusSchema)`)
- **Affected Roles:** any role passing `authorization`
- **Affected Tenant Scope:** write (status UPDATE) to another store's order item + order
- **Attack Surface:** `{ id: <foreign order id>, itemId: <foreign item id>, itemStatus }` in body
- **Root Cause:** `api/controller/order.js:2579` — `OrderItem.findOne({ where: { id: itemId, order: id } })`. `order_item` has no `store` column (FK `order` only; `db/models/order_item.js`), and neither `Order` nor `OrderItem` define a `defaultScope`/`scopes`. The query never verifies the parent `order.store` matches `req.storeId`, so it is a pure multi-tenant integer IDOR.
- **Attacker-Controlled Input:** body `id`, `itemId`, `itemStatus` (schema accepts `strToNum`; `itemStatus` enum).
- **Why It Is Exploitable:** Order and item IDs are sequential integers. Store-1 staff updates store-6's order item status (`preparing`/`ready`/`served`), and `:2608` cascades `Order.update({status}, {where:{id}})` — flipping another tenant's order to `served`/`ready`, corrupting kitchen + POS state. `emitItemStatusUpdate(order.store, ...)` (the only store touch) is purely for socket broadcast and provides no enforcement.
- **Reproduction:** From store-1 token: `PUT /order/update-item-status` `{ id: <store6 order>, itemId: <store6 item>, itemStatus: "served" }` → 200.
- **Existing Mitigation:** `validateStoreAccess` runs but only constrains body `store`/`storeId` scalar claims — the body here carries no store claim, so nothing is pinned.
- **Recommended Remediation:** Resolve the order with `relatedStoreInclude`/refuse when `order.store !== req.storeId`; add a store WHERE via the Order belongTo join (e.g. `Order.findOne({ where: { id }, include: [{ model: db.location, as: 'storeData', required: true, where: { id: req.storeId } }] })`) before mutating.
- **Regression Risk:** MEDIUM — same-store status updates must keep working; constrain only the value source, not the semantics.

## HIGH-4 — stockHistory.getByProduct returns all-store stock movements

- **Verdict:** CONFIRMED
- **Severity:** HIGH
- **Affected Endpoint:** `GET /stock-history/get-by-product/:productId` (`api/routes/stockHistory.js:16-20`)
- **Affected Roles:** any role passing `authorization` (no `requireRole`); also `get-all`, `low-stock` share the pattern
- **Affected Tenant Scope:** read of another store's stock movements for a product
- **Attack Surface:** `:productId` path param (product IDs are global, sequential)
- **Root Cause:** `api/controller/stockHistory.js` `getByProduct` — `db.stock_history.findAll({ where: { product: productId } })` with **no store condition**, even though `db/models/stockHistory.js:12` defines a `store` column and rows carry it.
- **Attacker-Controlled Input:** `productId` (sequential integer, enumerable).
- **Why It Is Exploitable:** DB-verified: `stock_history` has rows for store 1 (480), store 6 (18), and null (10). Store-1 admin/cashier requesting any product's history receives store 6's quantity movements (quantities, units, notes, reference types, created timestamps) for that product — plus their own.
- **Reproduction:** Authenticate store-1; `GET /stock-history/get-by-product/<id with store-6 movement>` → includes store-6 rows.
- **Existing Mitigation:** `validateStoreAccess`; no store filter in the query.
- **Recommended Remediation:** Add `store: req.storeId` (scalar) to the `where` for non-super-admin via `scalarStoreScope`; same for `getAll`.
- **Regression Risk:** LOW.

## HIGH-5 — inventory.js getStoreId accepts unvalidated input

- **Verdict:** CONFIRMED
- **Severity:** HIGH
- **Affected Endpoint:** `GET /inventory/forecast`, `/inventory/dead-stock`, `/inventory/expiring-soon`, `/inventory/valuation`, `/inventory/batch`, `/inventory/batch/:id`; `POST /inventory/forecast/run` (admin+)
- **Affected Roles:** any role passing `authorization` (GETs have no `requireRole`); admin+ for POST
- **Affected Tenant Scope:** read of another store's forecasts/batches/valuation; fail-open to all stores
- **Attack Surface:** `?storeId=`, `?store=`, `Cookie: store=`
- **Root Cause:** `api/controller/inventory.js:7-10` — `getStoreId(req) = req.query.storeId || req.query.store || req.cookies?.store || req.user?.store`. `validateStoreAccess` validates `req.query.store`, `req.body.store`, `req.body.storeId` — but **not `req.query.storeId` and not cookies**. Multiple endpoints then use `storeId` in `where` if present, else fall back to `where = {}` (fail-open): `getForecasts` (:17-18), `getBatches` (:170-172), `getValuation` (:133 via `aggregateValuation(nul…`), `getExpiringSoon` (:115).
- **Attacker-Controlled Input:** `?storeId=<foreign>`, `Cookie: store=<foreign>`, or absence of both.
- **Why It Is Exploitable:** A store-1 staff user sends `?storeId=6` → middleware sees no `req.query.store` (blind to `storeId`) → passes → `getForecasts` returns store-6 forecasts, `getBatches` returns store-6 product_batch rows (DB-verified: `product_batch` stores 1 and 6 both have rows). Omitting the param returns *all* stores (fail-open). `getDeadStock` requires a storeId (400 when none) but accepts the unvalidated foreign one.
- **Reproduction:** Store-1 token → `GET /inventory/forecast?storeId=6` → store-6 forecast data; `GET /inventory/batch` (no params) → batches for stores 1 and 6.
- **Existing Mitigation:** `validateStoreAccess` (partial — misses `query.storeId`/cookie); correct `tenantScope`/`req.storeId` usage present in *other* inventory-family code paths but not here.
- **Recommended Remediation:** Delete `getStoreId` entirely; use `req.storeId` (pinned by middleware) and `scalarStoreScope`, removing the cookie/`query.storeId` sources.
- **Regression Risk:** LOW.

## HIGH-6 — Socket.IO has no authentication

- **Verdict:** CONFIRMED
- **Severity:** HIGH
- **Affected Endpoint:** realtime namespace (`socket.io` at app server boot via `initSocket`)
- **Affected Roles:** unauthenticated clients (no token, no handshake check)
- **Affected Tenant Scope:** join any `kitchen-<id>` / `store-<id>` room and receive live events for every store
- **Attack Surface:** raw WebSocket handshake + arbitrary `storeId` in `join-kitchen`/`join-store`
- **Root Cause:** `api/service/socket.js` — `io.on('connection')` performs no token verification (`socket.handshake.auth`/`headers` never read); `forbidden? no` — `socket.on('join-kitchen', (storeId) => socket.join('kitchen-'+storeId))` accepts any value.
- **Attacker-Controlled Input:** storeId argument on join events.
- **Why It Is Exploitable:** `emitNewOrder(store, fullOrder)` (`api/controller/order.js:1114,3282`) and `emitItemStatusUpdate` (`:2595`) broadcast full order objects (order number, items, prices, per-item status) to `kitchen-<store>`/`store-<store>` rooms; `emitNotification` also emits `new-notification-global` to every client (`socket.js`). Any attacker connecting and sending `join-store`/`join-kitchen` for each integer storeId receives the other tenants' live sales/kitchen traffic.
- **Reproduction:** Connect a raw socket.io client, `emit('join-kitchen', 6)`; observe store 6 order broadcasts.
- **Existing Mitigation:** CORS origin check on handshake — easily spoofable/missing on non-browser clients; not an auth control.
- **Recommended Remediation:** Validate a JWT in the socket middleware; bind membership to the authenticated user's `store` claim (ignore client-supplied storeId); emit only into rooms the caller joined from their own claim.
- **Regression Risk:** MEDIUM — kitchen/warehouse front-ends must present the same auth token used by REST.

## HIGH-7 — product.js stores-array bypass + cookie/body store fallbacks

- **Verdict:** CONFIRMED
- **Severity:** HIGH (cross-tenant writes)
- **Affected Endpoint:** `POST /product/add-product`, `PUT /product/edit-product`, `POST /product/import` (`api/routes/product.js:95-118`; import `:64-71`)
- **Affected Roles:** `requireRole('super_admin','admin')` + `authorization` + `validateStoreAccess`
- **Affected Tenant Scope:** bind products into another store's catalog; write `product_store_stock` shadow stock rows into another store; (edit) adjust another store's shadow stock / stock history
- **Attack Surface:** `stores` array in body/multipart (validated only as numbers — `storeArray()` in `api/validation/schemas.js:66-70`), plus `Cookie: store=` / `body.storeId` for the per-store stock updates
- **Root Cause:**
  - `create`: `postAddProduct` parses `stores` (`product.js:669-676`) and, with **no validation tying store IDs to `req.user.store`**, calls `syncProductStores(postData.id, parsedStores)` (`:782`) writing into `product_store`, then `db.product_store_stock.create({ store: parsedStores[i], stock })` (`:786-797`) — writing stock into store 6 from a store-1 admin.
  - `edit`: `editProductByLocationAndId` fetches the product via the now-correct `findProductInScope(req, id)` (`:165-179`, scoped to user store OR unassigned/global), but the per-store stock mutation uses `const storeId = req.cookies?.store || req.body?.storeId` (`:1039`) driving `product_store_stock.update/insert` (`:1076-1094`) and the junction `syncProductStores(id, parsedStores, t)` (`:1071`) — both unvalidated. A global/unassigned product is editable by any store's admin, so `Cookie: store=6` writes store 6's shadow stock.
  - `import`: binds via `storeByName` (`:1642-1645`) and records `store: req.cookies?.store || null` in stock history (`:1736`).
  - `validateStoreAccess` never inspects the `stores` array, `req.query.storeId`, or cookies.
- **Attacker-Controlled Input:** body `stores:[...]`, body `storeId`, `Cookie: store`.
- **Why It Is Exploitable:** DB-verified `product_store` rows exist for stores 1 (17) and 6 (8). A store-1 admin can create a product with `stores:[1,6]` → store 6's cashier catalog/stock now shows attacker-controlled items/quantities (inventory integrity, cross-tenant data injection), and via cookie `store=6` on a global product edit, adjust store 6's `product_store_stock` value for that product.
- **Reproduction:** Store-1 admin: `POST /product/add-product` with multipart `stores=JSON.stringify([1,6])`, `stock=1000` → store 6 now has a product + 500/500 split stock rows. Then `PUT /product/edit-product` with `Cookie: store=6` on a global product → shadow stock adjusted in store 6.
- **Existing Mitigation:** `findProductInScope` blocks editing/delete of a product *assigned to another store* (only own-store or unassigned products reach mutation); `requireRole` limits to admins. These reduce blast radius but do not eliminate the create/import binding and unassigned-product shadow-stock write vectors.
- **Recommended Remediation:** After parsing `stores`, intersect with the caller's own store for non-super-admin (reject foreign IDs); replace cookie/body storeId on edits with `req.storeId`; apply the same clamps in import.
- **Regression Risk:** MEDIUM — multi-store product administration by super_admin must remain; clamp only for tenant admins.

## HIGH-8 — accountsReceivable.create joins a foreign store's order

- **Verdict:** CONFIRMED
- **Severity:** HIGH
- **Affected Endpoint:** `POST /ar/create` (`api/routes/accountsReceivable.js:22-23`)
- **Affected Roles:** any role passing `authorization` (no `requireRole` observed on create)
- **Affected Tenant Scope:** create AR referencing another store's order; disclosure of that order's customer name/number into the caller's own AR scope
- **Attack Surface:** body `orderId` (sequential integer)
- **Root Cause:** `api/controller/accountsReceivable.js:154` — `const order = await db.order.findByPk(orderId)` — no `store` match against `req.storeId`. The AR row is created with `store = req.storeId || req.user?.store || null` (`:136`, `:165`) so it lands in the caller's scope, but it references a foreign store's order: `invoiceNo = INV-${order.orderNumber || order.id}-...` and `customerName || order.customerName` (`:161,168`) disclose the foreign order's metadata.
- **Attacker-Controlled Input:** body `orderId`, `totalAmount`, `customerId`, `customerName`, etc.
- **Why It Is Exploitable:** Any store-1 staff can create an AR "for" a store-6 order that appears in store-1's books — financial record fabrication and cross-tenant order Number/customer-name disclosure. Read endpoints (`/list` `:94-95`, `getById` `:212`) are correctly scoped by `req.storeId`, so this is confined to the create-side join.
- **Reproduction:** Store-1 token → `POST /ar/create { orderId: <store6 order>, totalAmount: 1000 }` → 201 with `invoiceNo` embedding store-6 order number and `customerName` from store-6 order if absent.
- **Existing Mitigation:** list/getById scope by `req.storeId`; only the create join is unscoped. (The `store = req.storeId || …` source is correct here — the parent-order check is what is missing.)
- **Recommended Remediation:** Load the order with a tenant guard first; if `order.store !== req.storeId` (tenant) reject 403/404.
- **Regression Risk:** LOW.

## HIGH-9 — purchaseReturn.getAll trusts cookies and fails open

- **Verdict:** CONFIRMED
- **Severity:** HIGH
- **Affected Endpoint:** `GET /purchase-return` (`api/routes/purchaseReturn.js:36-40`), plus update/by-id endpoints using the same cookie pattern (`purchaseReturn.js:197,292,474`)
- **Affected Roles:** any role passing `authorization` (getAll has no `requireRole`)
- **Affected Tenant Scope:** read ALL stores' purchase returns (or another store via `Cookie`)
- **Attack Surface:** `Cookie: store=<foreign>` or omitting both cookie and query
- **Root Cause:** `api/controller/purchaseReturn.js:66-68` — `effectiveStore = userRole === 'super_admin' ? queryStore || cookieStore : cookieStore`; `if (effectiveStore) where.store = effectiveStore`. For a tenant: the only source is the unvalidated cookie; if no cookie is present, `effectiveStore` is falsy → `where = {}` → every store's returns (and counts in `:93-104`). `validateStoreAccess` never reads cookies.
- **Attacker-Controlled Input:** `Cookie: store`, absence of a cookie/`?store`.
- **Why It Is Exploitable:** DB-verified: `purchase_return` rows exist (with a store backend). A store-1 staff caller with no cookie → `where={}` → all stores' return records (return numbers, reasons, items, products, statuses). With a normal `authorization` header only and no cookie → fail-open all-stores.
- **Reproduction:** Store-1 token → `GET /purchase-return` with no `Cookie` → returns purchase returns owned by other stores; with `Cookie: store=1` → scoped (note the misleading "fix" behavior depends entirely on the client supplying the cookie).
- **Existing Mitigation:** None for tenants (cookie trust is the bug); `super_admin` path (`queryStore || cookieStore`) is intended global access.
- **Recommended Remediation:** Use `req.storeId` (pinned); `scalarStoreScope` for tenant rows; fail closed when store unknown. Also remove `req.cookies.store` from lines 197/292/474.
- **Regression Risk:** LOW.

# Cross-Finding Analysis

- **Root cause pattern A — unsafe store-source selection (HIGH-1, HIGH-5, HIGH-7, HIGH-9):** controllers read `req.cookies?.store`, `req.query.storeId`, or `req.body.storeId` directly instead of consuming `req.storeId` pinned by `validateStoreAccess`. The middleware's blind spots (`api/utils/storeValidation.js`: never reads cookies, never reads `query.storeId`, never inspects the `stores` array) are exactly what each of these exploits; the cookie fallback `req.cookies?.store || req.user?.store` silently overrides the JWT claim. Same pattern also remains in `ingredient.js` (112,154,223,319,396,586), `waiter-request.js` (124,173), `attendance.js` (9-12), `cashRegister.js` (13-16), `employeePerformance.js` (8,52,120), `stockOpname.js` (174), `order.js:2131` — these correspond to the deferred MED/LOW findings but share the *same* defect class and the same remediation.
- **Root cause pattern B — fail-open default `{}` when store is absent (HIGH-2, HIGH-9, inventory write of `where={}` in `getForecasts`):** a missing/blank store identifier silently means "every store" instead of "no rows". One consistent fix (require a pinned `req.storeId` or return zero rows) covers all of them.
- **Root cause pattern C — record fetch by bare primary key without parent-store ownership (HIGH-3, HIGH-8, HIGH-4 partial):** `OrderItem.findOne({id,order})`, `order.findByPk(orderId)`, `stock_history` filtered only by product. No model in these paths defines `defaultScope`/`scopes`, so the DB returns any store's row. `product.js` already fixed its read via `findProductInScope` (HIGH-7's edit scope) — that is the in-tree pattern to replicate.
- **Root cause pattern D — no authentication at the realtime edge (HIGH-6):** REST auth is enforced at route level, but the socket server trusts any connection, which is a separate trust boundary the middleware cannot cover.
- **Reusable mitigation:** `utils/tenantScope.js` (`scalarStoreScope`, `arrayStoreScope`, `relatedStoreInclude`) already encodes the correct "push the tenant condition into the WHERE/join" approach and is used by purchase_payment, delivery_order, queue, promo_campaign, supplier, driver, supplierBankAccount/supplierContact. HIGH-1..9's controllers do not use it — so remediation has a proven in-tree template and low ambiguity.
- **No duplicates:** all 9 are distinct endpoints/controllers; none is a strict duplicate of another, though patterns A/C recur.

# Phase 1 Regression Check

| Baseline | Result | Evidence |
|---|---|---|
| CRIT-1 register hardening | **PASS** | security-crit1-register.test.js green in run below |
| CRIT-2 user management | **PASS** | security-crit2-get-user.test.js green |
| CRIT-3 backup/audit | **PASS** | security-crit3-backup.test.js green |
| CRIT-4 export-master | **PASS** | security-crit4-export-master.test.js green |
| Other security suites | **PASS** | audit-log-hardening, tenant-isolation-idor, dashboard-tenant-isolation, store-isolation, ingredient-isolation, f7-bom-ingredient-deduction, customer-order-idempotency-concurrency, customer-order-rate-limit green |

Aggregate: **12/12 suites, 315/315 tests passed** (see Test Evidence). No Phase 1 file was modified during this audit; the 6 approved modified files and 4 untracked Phase 1 test suites are byte-identical to the approved baseline state (working tree at HEAD `ee10b07`). The FULL 57-suite / 720-test run had already passed at the end of Phase 1 and is unaffected by this read-only audit.

# Test Evidence

Command (read-only, serial, shared test DB):

```
NODE_OPTIONS="--max-old-space-size=8192" npx jest --forceExit --detectOpenHandles \
  --runInBand --no-cache \
  --testPathPatterns='security-crit1|security-crit2|security-crit3|security-crit4|tenant-isolation-idor|dashboard-tenant-isolation|store-isolation|ingredient-isolation|audit-log-hardening|f7-bom-ingredient-deduction|customer-order-idempotency-concurrency|customer-order-rate-limit'
```

Result:

```
Test Suites: 12 passed, 12 total
Tests:       315 passed, 315 total
Time:        28.502 s
```

DB-level evidence (read-only, dev DB `cashier_app`):

```
stock_history: store 1 → 480 rows, store 6 → 18, NULL → 10
product_batch: store 1 and store 6 both present
product_store: store 1 → 17, store 6 → 8
order: store 1 (pending 6, cancelled 2, served 56), store 6 (served 3);
       enum_order_status includes pending/preparing/ready/served (kitchen states)
location: store 1 = "Lawson", store 6 = "Family Mart" (both real stores)
```

This demonstrates multi-tenant production-shaped data exists, so HIGH-2/4/5/9's "other store" claims hold with real rows, not just theorized schemas.

# Final Remediation Priority

| Priority | Finding | Why this order |
|---|---|---|
| 1 | HIGH-6 (Socket.IO no auth) | Unauthenticated, realtime, full-order payloads; no token gate at all — widest blast radius. |
| 2 | HIGH-2, HIGH-9 (fail-open all-store reads) | Any authenticated staff reads *every* store's orders / purchase returns by simply omitting params/cookies — trivial, no guessing. |
| 3 | HIGH-1, HIGH-5 (cookie / query.storeId trust on reads) | Cross-store sales/inventory reads; requires one extra header — trivial for any staff. |
| 4 | HIGH-3 (order-item IDOR write) | Cross-store order/kitchen state corruption; needs guessed IDs but IDs are sequential. |
| 5 | HIGH-8 (AR creates against foreign order) | Cross-store financial record fabrication + metadata disclosure. |
| 6 | HIGH-4 (stock history by-product all-store) | Cross-store stock-movement reads; sequential product IDs. |
| 7 | HIGH-7 (product stores-array + cookie shadow-stock writes) | Admin-only, and `findProductInScope` already narrows the edit path — highest effort, most contained. |

Recommended batching: (1) alone; (2)+(3) together as the `req.storeId`/`scalarStoreScope` cookie-and-fail-open sweep; (4)+(5)+(6) as per-record ownership checks with `relatedStoreInclude`; (7) as an admin-path clamp. All can reuse `utils/tenantScope.js` and preserve same-store behavior with the LOW–MEDIUM regression risks listed per finding.