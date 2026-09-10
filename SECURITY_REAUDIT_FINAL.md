# FINAL INDEPENDENT READ-ONLY SECURITY RE-AUDIT — BE-POS-App

**Status: NOT APPROVED**
**Auditor:** Independent (this session). No source/test/config modified; no commits created.
**Date:** 2026-09-08

---

## A. EXECUTIVE VERDICT

**NOT APPROVED.**

All SIX original findings (N-1, N-2, N-3, N-4, N-5, N-11) are verified **closed** by direct
code-level tracing — including the two whose labels Astra's report muddled:
**Original N-1 (POS invoice IDOR) and Original N-3 (WhatsApp session control) are both
VERIFIED CLOSED.**

However, the independent global tenant-boundary sweep found **four NEW HIGH cross-tenant
WRITE vectors** (type_payment, category, shift, delivery driver creation) and several MEDIUM
cross-tenant disclosure vectors. Per the stated verdict rule — *NOT APPROVED if even one HIGH
remains* — the system is not approved regardless of the original findings.

The root cause of all four NEW HIGHs is the same: `validateStoreAccess` validates tenant
claims with `parseInt(req.body.store)`, a **scalar-only** check that `[own, foreign]` arrays and
JSON-string array payloads bypass, and the write controllers never intersect the requested
store list with `req.storeId`/the JWT claim.

---

## B. ORIGINAL FINDINGS MATRIX (original definitions — not renamed)

| # | Original definition / endpoints | Verdict | Evidence (queried/traced this audit) |
|---|---|---|---|
| **N-1** | POS invoice IDOR — `POST /pos/invoice/send-wa`, `POST /pos/invoice/send-email` | **VERIFIED CLOSED** | `sendInvoiceWhatsApp` (pos.js:2700-2707) and `sendInvoiceEmail` (pos.js:2883-2890) both load the order with `db.order.findOne({ where: { id: orderId, ...scalarStoreScope(req) } })` — tenant condition is **in the SQL WHERE**, not a post-hoc check. `scalarStoreScope` (tenantScope.js:50-54) pins non-super-admin to the JWT `store` claim (`-1` if absent). Foreign order → `404`, response contains no foreign fields, and `sendDocument`/email dispatch can never run because the order is looked up first. Super_admin intentionally unscoped. Route chain (routes/pos.js:139-154): `authorization + validateStoreAccess + validate`. Guard test `security-n1` (7 tests) mocks `whatsappClient.sendDocument` and asserts it is NOT called for foreign orders; own-store + super_admin paths still send. |
| **N-2** | POS product-price cross-tenant read/write — `update-price-by-store`, `price-by-store` | **VERIFIED CLOSED (original vector)** | `getPriceByStore` (pos.js:2533-2544) intersects `?storeIds=` with `req.storeId` for non-super-admin (excluded if not own; defaults to own). `updatePriceByStore` (pos.js:2614-2625) → 403 if any `storePrices[].storeId` is numeric and ≠ own store. DB rows verified unmutated by suite `security-n2` (6 tests; asserts store2 `product_store_price` rows unchanged). **Residual:** the `'base'` sentinel writes the shared `product.price` for an **unscoped** `productId` — see C (NEW). |
| **N-3** | WhatsApp session control — `getWhatsAppStatus`, `logoutWhatsApp`, `restartWhatsApp` | **VERIFIED CLOSED** | All three obtain store via `getAuthorizedStoreId(req)` (pos.js:19-29): non-super-admin is pinned to `Number(req.storeId)`; a finite foreign `?storeId` returns `null` → 403; `?storeId==own` allowed; only super_admin may target an arbitrary `?storeId`. `getConnectionStatus/logout/restartClient` are fed that value (pos.js:3031-3100) and mounted under `authorization + validateStoreAccess` (+ `requireRole('super_admin','admin')` for logout/restart). Suite `security-n3` (6 tests) verifies foreign `?storeId` yields no `getConnectionStatus/logout/restartClient` call and own/super paths work. |
| **N-4** | stock-opname export IDOR — `POST /stock-opname/export-selected` | **VERIFIED CLOSED** | `exportSelected` (stockOpname.js:1313-1318) queries `db.stockOpname.findAll({ where: { id: { [Op.in]: ids }, ...scalarStoreScope(req) } })`. Foreign ids are excluded by the WHERE; mixed lists export only own-store rows; all-foreign → 404. Suite `security-n4` unzips the xlsx and asserts no `STORE_B_SECRET` cell appears; own-store and super_admin exports still work; DB row untouched. |
| **N-5** | unauthenticated customer-create cross-tenant injection — `POST /order/customer-create`, `POST /waiter-request/customer-create` | **VERIFIED CLOSED** | Both require a valid `tableId` and fetch `db.table.findOne({ where: { id: tableId, store: <claimedStore> } })` (order.js:2857-2863, waiter-request.js:37-41) — the claimed store is only a **pair-match key**, the authoritative store for persistence/emission is `table.store` (`store = Number(table.store)||…`; waiter `store:[storeId]`, `emitToStore(storeId,…)`). Table-less/mismatched → 400 **before** any `Order.create`/`waiter_request.create`, so no foreign row and no foreign-room emission. The `store:null`-table fallback is unreachable because the pair-match WHERE `store = <claimed>` can never match a NULL store. Suite `security-n5` (5 tests) asserts no rows created in B on mismatch/table-less and correct persisted store on legit flow. **Residuals:** read-only public `getCustomerList` (see C); public endpoint trusts client `item.price` (billing integrity, non-tenant). |
| **N-11** | unassigned-account tenant fail-open | **VERIFIED CLOSED (as defined)** | `validateStoreAccess` (storeValidation.js:28-33) now 403s (`Store assignment required`) any non-super-admin whose JWT has no finite positive `store` claim BEFORE any controller runs; `req.storeId = userStore`. `resolveStoreId` (tenantScope.js:35-41) ignores client query/body/cookie for non-super-admin. Purchase-payment, expense, currency etc. verified. Suite `security-n11` (7 tests) RED/GREEN verified. **CAVEAT:** the middleware's scalar `parseInt` check still permits **arrays** on *write* bodies — exploited by the four NEW HIGHs below (assigned-admin class, not unassigned). |

**Label note re Astra's report:** Astra's matrix called N-1 "product list/price" and N-3
"stock-taking." The actual test files `security-n1-invoice-send-idor.test.js` and
`security-n3-whatsapp-tenant-isolation.test.js` cover the ORIGINAL definitions exactly. The
label drift is cosmetic only; the original vulnerabilities are closed.

---

## C. NEWLY DISCOVERED FINDINGS

### HIGH — cross-tenant WRITE (authenticated store admin)

**C-1. type_payment creation/edit — injected into an arbitrary store**
- Endpoint: `POST /type-payment/add-new-type-payment`, `PUT /type-payment/edit-type-payment/:id` (routes/type-payment.js — `authorization, validateStoreAccess, requireRole('super_admin','admin')`).
- Function: `postNewTypePayment` (type-payment.js:186-249); `resolveStoreIds` receives
  `rawStore = req.body.store ?? req.user?.store` (type-payment.js:188-189) and **never
  intersects** with `userStore` (lines 10-27).
- Tenant trust source: client `body.store`, `"[5,6]"`/`[5,6]`. `validateStoreAccess`
  (scalar `parseInt`) is bypassed two ways: `parseInt([5,6])` → `5` (own first) matches, and
  `parseInt("[5,6]")` → `NaN` (falsy → no mismatch). Schema `createTypePaymentSchema`
  (schemas.js:1000-1022) passes arrays/JSON-strings through.
- Exact query: `TypePayment.create({ ..., store: target })` for each target in
  `stores = […(possibly foreign store)…]` (lines 200-221).
- Exploit: store-A admin posts `{"name":"PAYLOAD","store":[A,B]}` or `"<<store B>>`
  → a type_payment row is created under store B and appears at B's payment screen.

**C-2. category creation/edit — junction rows injected into an arbitrary store**
- Endpoint: `POST /categories/add-new-category`, `PUT /categories/edit-category/:id`
  (routes/category.js — `authorization, validateStoreAccess, requireRole('super_admin','admin')`).
- Function: `createCategory`/`editCategoryById` (category.js:414-420) →
  `parsedStores = parseStoreField(body.store)` (fully trusted, no scope intersection) →
  `syncCategoryStores` bulk-creates `db.category_store` rows (category.js:80-104).
- Tenant trust source: client `body.store` array/JSON-string (schema `storeArray()`,
  schemas.js:66-80 transforms `"[5,6]"` → `[5,6]`).
- Exploit: store-A admin creates a category visible in store B's catalog.

**C-3. shift creation/edit — shifts injected into an arbitrary store**
- Endpoint: `POST /shift/add-new-shift`, `PUT /shift/edit-shift/:id`
  (routes/shift.js — `authorization, validateStoreAccess, requireRole('super_admin','admin')`).
- Function: `postNewShift` (shift.js:188-320) `rawStore = req.body.store || req.storeId || req.user?.store`; `stores = toStoreArray(rawStore)` (shift.js:40-45, no intersection); loop `Shift.create({ ..., store: storeId })` (shift.js:280-294). Schema `store: z.any()`.
- Exploit: store-A admin creates shift rows attributed to store B.

**C-4. delivery driver create/update — driver assigned to an arbitrary store**
- Endpoint: `POST /delivery/drivers`, `PUT /delivery/drivers/:id`
  (routes/delivery.js:101-117 — `authorization, validateStoreAccess, requireRole('super_admin','admin')`, `validate(createDriverSchema)`).
- Function: `createDriver` (delivery.js:571-607) persists `store: store || null` from body
  (schema `storeArray()`); `updateDriver` (delivery.js:609-645) writes body `store` onto a
  driver found in own/global scope → can move an owned driver into a foreign store's array.
- Exploit: store-A admin sets driver `store:[A,B]` → driver becomes visible/assignable in
  store B.

**Shared RA for C-1..C-4:** endpoint chain, vulnerable function, tenant trust source
(client `body.store` array), DB queries above, attack = authenticated store admin posts an
own-first/JSON-string array, remediation = intersect requested stores with
`req.storeId`/JWT claim for non-super (as product.js already does) and/or reject
array/JSON-string `store` at the middleware, regression coverage = new suites asserting no
foreign-store row after request plus preserved own-store behavior.

### MEDIUM — cross-tenant disclosure / low-impact write

- **C-5. Notifications fail-open for `kasir`** — notification.js `getAllNotifications`
  (13-19), `getUnreadCount` (71-74), `markAllAsRead` (140-145) only scope when
  `?store=` provided or role ∈ {admin,user}; `kasir` (valid role, db/models/user.js:17)
  with no `?store=` reads **every tenant's** notifications and, via `read-all`, flips
  `isRead` on all tenants. Routes mount only `authorization + validateStoreAccess`.
  `markAsRead` (:91-133) is correctly scoped.
- **C-6. Ingredient-category detail leaks all tenants' ingredient stock/cost** —
  `GET /ingredient-category/get-by-id/:id` (route has NO `requireRole`) →
  `ingredientCategory.js getById` :101-105 `db.ingredient.findAll({ where: { category: id } })`
  with no `store` filter and `attributes [...,'stock','minStock','unit','costPrice']`
  on a store-owning model.
- **C-7. Location detail unscoped** — `GET /location/get-location-detail/:locationId`
  (any authorized role) → `getLocationById` (location.js:728) `Location.findByPk(dbId)` with
  no store constraint returns other tenants' `phoneNumber, email, managerName, dailyTarget,
  openingHours, socialMedia` + audit user names. (Public endpoint already exposes
  name/city/address/geo for all — this adds contact PII + internal revenue target.)
- **C-8. Public waiter-request customer list** — `GET /waiter-request/customer-list`
  (unauthenticated, route comment "no auth") reads any store's waiter requests by guessable
  numeric `store` (± `tableId`): `db.waiter_request.findAll({ where: { store:{Op.contains:
  [storeId]}, … } })` and returns `customerName, orderId, notes, type, status`. No
  table→store ownership cross-check. **(Previously reported residual; still open.)**
- **C-9. Shared/global-row mutation by any store admin** — member `editMember`/`deleteMember`
  (member.js:313-317), type-payment edit (type-payment.js:270-279), supplier `getDetail/
  getById/update` (supplier.js:938-948) use guards that a falsy/empty `store` bypasses, then
  mutate the row unscoped → store admin can rewrite `store:null`/`store:[]` shared rows for
  all tenants.
- **C-10. `addBatch` unscoped product mutation** — `PUT /pos/product/add-batch` (pos.js:2916-2990,
  admin) `db.product.findByPk(productId)` (no `findProductInScope`), then increments
  `product.stock` and writes `stock_history`/`batch` under `effectiveStore = store ||
  req.storeId` (body store). Impact: shared-inventory tampering on products outside the
  caller's store.
- **C-11. `updatePriceByStore` `'base'` sentinel — cross-tenant base-price influence** —
  `updatePriceByStore` (pos.js:2627) loads the product with an **unscoped**
  `db.product.findByPk(productId)`, and the `'base'` branch writes `product.price`
  (pos.js:2637-2640). The public/QR + POS checkout derive unit price from `product.price`
  (`order.js:189`), never from `product_store_price`. Therefore a store-A admin can change
  the checkout price of a product exclusively sold at store B. This is a remnant of the
  original N-2 class (cross-tenant price write); it predates the N-2 fix (which only
  restricted numeric per-store rows) but contradicts the spirit of the finding and bypasses
  the product-scope discipline now enforced in `put /product/edit-product`.

### NON-TENANT (reported separately, not part of the verdict gate)
- **C-12. Public `order/customer-create` trusts client `item.price`** — order.js:3090
  `subtotal = item.price * item.quantity` with no server-side re-derivation (POS flow
  re-derives prices server-side; this public flow does not). Customers can place orders at
  self-set unit prices, understating the amount the cashier collects. Billing-integrity
  issue on an unauthenticated endpoint. (Not a tenant-boundary violation.)

---

## D. GLOBAL TENANT-BOUNDARY ASSESSMENT

- Reads (lists/id-fetches) across order, purchase, sales-return, accounts-receivable, expense,
  stock-opname, goods-receipt, production-order, goods-request, purchase-payment, promo, queue,
  delivery-order, business-trip, inventory, currency, cash-register: scoped at the **SQL
  WHERE** (`scalarStoreScope`/`arrayStoreScope`/`resolveStoreId`/inline `where.store`) with the
  middleware pinning `req.storeId` to the JWT claim. No unscoped `findByPk`+post-check pattern
  was found in the controllers I audited directly (`pos`, `order`, `waiter-request`,
  `stockOpname`, `purchasePayment`, `type-payment`, `category`, `shift`, `delivery`,
  `notification`, `ingredientCategory`, `location`, `table`, `product`).
- **The systematic gap** is the array/JSON-string `body.store` bypass (C-1..C-4) on W writes
  in controllers that treat store as a list (junction/collection models). Controllers that
  coerce `store` to a single number (schema `strToNum`) are safe on this axis because the
  middleware blocks mismatched numeric claims.
- Column-shape inconsistency (`promo_campaign`/`queue` JSONB stored as scalars vs
  `Op.contains` conventions) is a pre-existing correctness bug, not a tenant escape after the
  N-11 guard (unassigned → 403 first).

## E. UNASSIGNED-ACCOUNT ASSESSMENT

- Unassigned non-super-admin accounts (no numeric JWT `store`): 403 `Store assignment
  required` at the middleware on every tenant route they can reach; `req.storeId` pinned.
  Urls/body/query/cookie forgery of `store` cannot pass for a scalar claim. Verified in the
  guard (storeValidation.js:28-33), `resolveStoreId` (tenantScope.js:35-41), and the
  `security-n11` suite (RED when guard disabled). Routes missing `validateStoreAccess`
  (region, reportConfig, role) expose only non-tenant reference/shared config.
- Residual note: `resolveStoreId` for super_admin falls back to `cookies.store` — by design
  (global switch). Not a violation.

## F. PARENT-RESOURCE IDOR ASSESSMENT

- High-value relationship reads verified scoped in-query: order→items/payments, sales-return,
  purchase-return (now validated against the PO store), accounts-receivable, batch/stock-history,
  supplier-bank/purchase child rows (inner-join via `relatedStoreInclude`). No NEW CRITICAL or
  HIGH parent IDOR found.
- MEDIUM/LOW confidence findings are C-5 (notification), C-6 (ingredientCategory), C-7
  (location detail), C-9 (null-store guard bypass), C-10 (addBatch product), C-11 ('base').

## G. REALTIME ASSESSMENT

- `emitToStore` (socket service) has no internal auth guard; **every feeder is gated**:
  public customer-create feeds only `table.store` (authoritative); POS/waiter/stock/payment
  feeds consume `req.storeId` (JWT-pinned). Room membership binds to the signed `store` claim
  on join. No public or cross-tenant-controlled storeId reaches an emission channel.
  C-12 (billing) aside, the customer-create feed remains tenant-correct.

## H. GUEST/PUBLIC ENDPOINT ASSESSMENT

- **Purchase-payment guest fallback (`req.storeId || req.cookies.store`):** all
  purchase-payment routes mount `authorization + validateStoreAccess`; no unauth route
  exists. For assigned non-super-admin `req.storeId` is always set and short-circuits the
  cookie; cookie cannot steer an authenticated user to another store. Effectively dead/safe.
- Public endpoints: `customer-menu`, `customer-orders` (validates store+table pair),
  `receipt-html/:token`, `customer-tax-rate`, `customer-review` (product-orderability-bounded),
  `waiter-request/customer-create` (table-paired) — none provide a tenant-write side channel.
  **Exception:** `waiter-request/customer-list` (C-8) is an unauthenticated cross-tenant READ.

## I. SECURITY TEST QUALITY

- The six dedicated suites (`security-n1` 7, `n2` 6, `n3` 6, `n4` 5, `n5` 5, `n11` 7 = 36) use
  the **real test DB**, two real stores, real records, real JWT tokens and assert on **response
  payload + DB state + external side effects**:
  - N-1: mocks `whatappClient.sendDocument` and asserts zero side-effect calls + no leaked
    fields + DB row unchanged.
  - N-2: asserts `product_store_price` rows for store B are unchanged after blocked writes.
  - N-3: asserts `getConnectionStatus/logout/restartClient` never called for foreign `?storeId`.
  - N-4: parses the exported xlsx and asserts store-B content never appears; own/super paths work.
  - N-5: counts rows in store B before/after mismatch attacks; asserts persisted store.
  - N-11: forged cookie/query payloads; asserts 403 + no data; RED-verified by disabling the guard.
- Not just `expect(status).toBe(403)` — status, payload, DB state, and side-effect-orchestration
  are asserted together. Quality is adequate for the original findings.
- **Blind spot:** none of the six suites covers the array/JSON-string `body.store` bypass
  (C-1..C-4), which is why the new HIGHs coexist with a green suite set.

## J. EXACT TEST COMMANDS / RESULTS

```
cd BE-POS-App
NODE_OPTIONS="--max-old-space-size=8192" npx jest --forceExit --runInBand --no-cache --testPathPatterns='security-crit'   → 4 suites passed / 48 tests passed
NODE_OPTIONS="--max-old-space-size=8192" npx jest --forceExit --runInBand --no-cache --testPathPatterns='security-high'   → 10 suites passed / 74 tests passed
NODE_OPTIONS="--max-old-space-size=8192" npx jest --forceExit --runInBand --no-cache --testPathPatterns='security-medium' → 1 suite passed / 19 tests passed
... --testPathPatterns='security-n1|…|security-n11' → 6 suites / 36 tests passed
NODE_OPTIONS="--max-old-space-size=8192" npx jest --forceExit --runInBand --no-cache  (full)
```

Full-suite results observed this run:
- Run 1: 2 suites failed / 7 tests failed → re-run
- Run 2: re-run isolate: **`f7-bom-ingredient-deduction.test.js` — REV-BUNDLE-IDEMPOTENT-REVERSE — `Exceeded timeout of 5000 ms`** (a single Jest test timeout)
- `f7-bom-ingredient-deduction` run **alone** → **41/41 passed**
- Conclusion: the full-suite failure is an **infrastructure/timing flake** (single 5000 ms test timeout under `--runInBand` + machine load), not a product/security regression. No code changes made. Remaining suites all green.

**Astra's claimed "74 suites / 849 tests / 0 failures" cannot be fully reproduced as a stable
0-failure full run** on this hardware (one timing-sensitive test intermittently exceeds 5000 ms);
all suites pass individually and every security suite passes.

## K. REMAINING MEDIUM/LOW (documented)

| ID | Finding | Severity | Exploitability | Endpoint | Recommendation |
|---|---|---|---|---|---|
| C-5 | Notification kasir fail-open (read + read-all write across tenants) | MEDIUM | authenticated `kasir` (lowest role), no `?store=` | `GET /notification`, `/notification/unread`, `PUT /notification/read-all` | scope `where.store` from `req.storeId` for ALL non-super roles |
| C-6 | Ingredient category detail leaks all tenants' stock/costPrice | MEDIUM | any authenticated role, iterate category ids | `GET /ingredient-category/get-by-id/:id` | add `store` filter on `ingredient.findAll` |
| C-7 | Location detail unscoped (contact PII + dailyTarget) | LOW-MEDIUM | any authenticated role, guessable `loc-N` ids | `GET /location/get-location-detail/:locationId` | require super_admin or scope by store |
| C-8 | Public `waiter-request/customer-list` cross-tenant read | MEDIUM-HIGH | unauthenticated, guessable store ids | `GET /waiter-request/customer-list` | require a per-table/per-store capability token; verify table→store before returning rows |
| C-9 | Global/shared rows mutable by any store admin (member/type-payment/supplier) | LOW | store admin on `store:null`/`store:[]` rows | member edit/delete, type-payment edit, supplier get/update | reject non-super when record has no store assignment |
| C-10 | `addBatch` unscoped product stock mutation | MEDIUM | store admin, guessed productId | `PUT /pos/product/add-batch` | reuse `findProductInScope`; pin store to `req.storeId` |
| C-11 | `updatePriceByStore` `'base'` cross-tenant price influence | MEDIUM-HIGH | store admin, guessed productId | `PUT /pos/product/update-price-by-store` | require `findProductInScope(productId)`; restrict `'base'` to super_admin or own-store products |

## L. FINAL PRODUCTION RECOMMENDATION

1. **Do not deploy to production without remediating C-1..C-4** (four HIGH cross-tenant
   writes) and C-8 (unauthenticated cross-tenant read). Together they defeat the
   tenant-isolation contract that N-1..N-5/N-11 were meant to establish.
2. Implement the fix in the layer closest to the trust boundary:
   - In `validateStoreAccess`, reject array/object/JSON-string `store` claims for
     non-super-admin (enforce a single numeric store equal to the JWT claim), AND
   - In every controller that treats `store` as a list (type-payment, category, shift,
     delivery drivers), intersect requested store ids with `req.storeId`/the JWT claim for
     non-super-admin (the `foreignStores` pattern already used in product.js).
   - Add regression suites for C-1..C-4 asserting an absent foreign-store row + preserved
     own-store behavior (mirroring the existing suite discipline).
3. Follow up on C-5..C-11 per Section K, prioritizing C-8 and C-11.
4. Address C-12 (client-controlled item price on the public customer-create endpoint) as a
   billing-integrity defect independent of tenancy.
5. Re-run: eager IDOR + realtime sweeps, then the full suite; treat the single 5000 ms
   `f7-bom-ingredient-deduction` test timeout as infra flake (optionally raise its timeout).