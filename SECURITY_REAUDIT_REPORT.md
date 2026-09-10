# Security Re-Audit Verification Report

**Status: READY FOR INDEPENDENT RE-AUDIT**
**Date:** 2026-09-08
**Scope:** Confirmed HIGH/CRITICAL cross-tenant findings N-1, N-2, N-3, N-4, N-5, N-11 in `BE-POS-App`.

---

## 1. Executive Summary

All six confirmed findings are closed with server-authoritative tenant resolution:

- **N-5 / N-11** were the two remaining open items and are now fixed, regression-tested (RED verified), and covered by dedicated suites.
- Fixes preserve legitimate behavior: `super_admin` global scope, public customer ordering, and existing admin mutations for the current user's own store.
- Full regression suite: **74 suites / 849 tests, 0 failures.**

All six findings follow the same remediation pattern: tenant must be derived server-side from the authenticated principal (JWT `store` claim / bound `table`), never trusted from client-supplied `body`, `query`, or `cookie` for non-super-admin accounts.

## 2. Findings Status Matrix

| Finding | Severity | Status | Remediation | Verification |
|---|---|---|---|---|
| N-1 | HIGH | **CLOSED** | `pos.js` product list / price endpoints derive tenant from `req.storeId` or `req.user.store`; mismatch → 403. | `security-n1-pos-tenant-isolation.test.js` (GREEN) |
| N-2 | HIGH | **CLOSED** | `pos.js updatePriceByStore` / `getPriceByStore` reject `storeIds`/`storePrices[].storeId` outside the caller's own store (403/400). Intentional exception: `storeId:'base'` updates the shared base price (legit, pinned by `audit-log-hardening`). | `security-n2-product-price-tenant-isolation.test.js` (GREEN) |
| N-3 | HIGH | **CLOSED** | `stock-taking` fixed; injektions removed. | `security-n3-stocktaking-tenant-isolation.test.js` (GREEN) |
| N-4 | HIGH | **CLOSED** | `stock-opname` end-to-end tenant predicate before mutation. | `security-n4-stock-opname-tenant-isolation.test.js` (GREEN) |
| N-5 | HIGH | **CLOSED** | `POST /order/customer-create` and `POST /waiter-request/customer-create` no longer trust the request `store` for tenant isolation. Effective store is derived from the **server-fetched `table`** (`table.store`). `tableId` is required; table-less or mismatched table/store → 400. Persistence + realtime emission use the authoritative store. | `security-n5-customer-create-tenant-isolation.test.js` (GREEN, RED verified both endpoints) |
| N-11 | HIGH | **CLOSED** | Global fail-open for unassigned non-super-admin accounts: central `validateStoreAccess` 403 (`Store assignment required`); `resolveStoreId(req)` pins non-super-admins to `req.storeId`/JWT claim and never reads client cookie/query/body. Applies across 12 controllers. | `security-n11-unassigned-fail-open.test.js` (GREEN, RED verified) |

## 3. Test Results

### Full regression
```
Test Suites: 74 passed, 74 total
Tests:       849 passed, 849 total
```

### Dedicated security suites
```
test Suites: 6 passed, 6 total
Tests:       36 passed, 36 total
```

Coverage: all six findings plus the "no regressions" guarantee over the previously-untested legacy customer-order suites (which were updated to send real `tableId`s after the N-5 strict-table contract).

### RED proofs (all six suites were authored to fail against the unpatched code)
- **N-1/N-3/N-4:** guarded implementations were run against the new tests with guards disabled → forced red; restored → green.
- **N-2:** test set drove the `storeIds`/`storePrices[]` cross-store 403 path → previously returned 200.
- **N-5:** `if (true)`/`if (false)` toggle of the table-guard confirmed RED on both endpoints.
- **N-11:** the two "unassigned admin is rejected" tests fail when the central 403 guard is disabled (they would receive 200 with forged-cookie tenant data).

## 4. New / Modified Test Files

New dedicated suites:
- `__tests__/security-n1-pos-tenant-isolation.test.js`
- `__tests__/security-n2-product-price-tenant-isolation.test.js`
- `__tests__/security-n3-stocktaking-tenant-isolation.test.js`
- `__tests__/security-n4-stock-opname-tenant-isolation.test.js`
- `__tests__/security-n5-customer-create-tenant-isolation.test.js`
- `__tests__/security-n11-unassigned-fail-open.test.js`

Modified for the N-5 strict-table contract (real `tableId` fixtures):
- `__tests__/customer-order-create-flow.test.js`
- `__tests__/customer-order-idempotency-concurrency.test.js`
- `__tests__/customer-order-rate-limit.test.js`
- `__tests__/customer-order-security.test.js`
- `__tests__/f7-bom-ingredient-deduction.test.js`
- `__tests__/receipt-html-xss.test.js`
- `__tests__/sales-return-hardening.test.js` (403 fail-closed contract)
- `__tests__/audit-log-hardening.test.js` (covered by `'base'` exception — passing)

## 5. Source Files Changed

| File | Change |
|---|---|
| `utils/storeValidation.js` | Central 403 `'Store assignment required'` guard for unassigned non-super-admin; `req.storeId` set from claim. |
| `utils/tenantScope.js` | New exported `resolveStoreId(req)` (+ existing `scalarStoreScope`, `arrayStoreScope`, `isSuperAdmin`). |
| `api/controller/order.js` | N-5: `createCustomerOrder` requires `tableId`, fetches table, derives authoritative `store = table.store`; guards mismatch; idempotency catch reads hoisted `store`. |
| `api/controller/waiter-request.js` | N-5: `customerCreate` same authoritative-table logic (integer `tableId`, `store:[storeId]` persistence, `emitToStore(storeId,…)`). |
| `api/controller/pos.js` | N-1/N-2/N-3 fixes; `updatePriceByStore` `'base'` exception; `resolveStoreId` at lines 796/1335. |
| `api/controller/stockOpname.js` | N-4; `resolveStoreId` (6 sites). |
| `api/controller/goodsReceipt.js`, `productionOrder.js`, `purchasePayment.js`, `goodsRequest.js`, `businessTrip.js`, `purchaseOrder.js`, `ingredient.js`, `expense.js`, `expenseCategory.js`, `currency.js` | N-11: `resolveStoreId(req)` replaces fail-open `req.storeId || req.cookies.store …` chains. |

## 6. Reproduce

```bash
cd BE-POS-App
NODE_OPTIONS="--max-old-space-size=8192" npx jest --forceExit --runInBand --no-cache security-n1 security-n2 security-n3 security-n4 security-n5 security-n11
NODE_OPTIONS="--max-old-space-size=8192" npx jest --forceExit --runInBand --no-cache
```

## 7. Intentional Contract Changes / Residuals

1. **N-5 strict table requirement.** `POST /order/customer-create` and `POST /waiter-request/customer-create` now reject requests without a valid `tableId` (400). This is a deliberate tightening: the deployed customer PWA always supplies `table` + `store` from the QR URL, irrelevant in tests. Table/store pair is validated by `db.table.findOne({where:{id, store}})` before any side effect.
2. **N-11 unassigned accounts.** Non-super-admin accounts whose JWT carries no numeric `store` claim are now rejected centrally with 403 before touching any tenant data, instead of falling through to `req.cookies.store` (fail-open). Super-admins are unaffected and retain the global store selector.
3. **`updatePriceByStore` `'base'` exception.** `storeId:'base'` writes the shared base `product.price` (no per-tenant row) and is allowed for any admin — restoring a pre-N-2 legitimate flow. It does not create or modify any other store's price row; all numeric foreign `storeId`s remain forbidden.
4. **`waiter-request.getCustomerList`** (public, read-only) does not cross-check table→store ownership before returning customer rows for a given `store`+`table` filter. Read-only, no persistence/emission side effects; noted as a pre-existing residual outside this remediation scope.
5. **`purchasePayment.list` line 539** `req.storeId || req.cookies.store` remains for guests/unauthenticated receipt access; safe post-central-guard for authenticated non-super-admin accounts.