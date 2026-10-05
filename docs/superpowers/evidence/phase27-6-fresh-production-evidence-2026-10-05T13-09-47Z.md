# Phase 27.6 — Fresh Production Read-Only Evidence Capture

This is fresh production evidence captured after the D-06 / D-08 manifest
correction (PR #160) was merged. It checks whether production still matches
the assumptions behind the merged disposition model. It is evidence only: it
does **not** approve `production.json`, does not stamp SequelizeMeta, does not
authorize controlled applies or E2, and does not change any decision.

- Fresh capture window (UTC): **2026-10-05T13:09:47.909Z – 2026-10-05T13:09:54.756Z**
- Repository commit used: `3dd78c4813aded3b21fce2f9445856e1728c05b7`
  (`origin/master`, merge of PR #160, which contains `9a690be`)
- Historical comparison point: W-02R.3R capture 2026-10-02T12:06:33Z–12:06:39Z
  (`w02r3r-raw-capture-2026-10-02T12-09-42Z.json`). That file is not modified.
- Production identity (no secrets): database `neondb`, role `neondb_owner`,
  PostgreSQL `17.11 (fcae950)`. This is unchanged from 2026-10-02.
- Raw capture: `phase27-6-raw-capture-2026-10-05T13-09-47Z.json`
  (SHA-256 `8590856d3d3f3dda7f1943e5cf894e1b050c9d0e94527d62a1d414497c18e24b`)

Wherever both appear, "fresh" means observed on 2026-10-05 and "2026-10-02"
means the historical W-02R.3R observation.

## 1. Read-only mechanism

- Connection shape: the same as `scripts/check-production-schema.js`
  `buildProductionSequelize()`. Credentials come from `.env.production` and
  are never printed. SSL is required.
- All queries ran inside the repository's own `withReadOnlyTransaction()`
  (`BEGIN; SET TRANSACTION READ ONLY`). Inside that transaction
  `SHOW transaction_read_only` returned **`on`**.
- Guards: the run refuses if a production variable is missing or the host is
  local. Error text is scrubbed of host and credentials.
- Query set: the W-02R.3R definitions are reused verbatim, except for privacy
  changes. The member duplicate checks return counts instead of value rows.
  The super_admin population is reported as aggregates; the only usernames
  read are the four seed names already checked on 2026-10-02. The capture
  also adds SequelizeMeta, the split_bill NULL-status count, role-menu
  presence checks and D-05 collision counts. Every query is a SELECT.
- No INSERT, UPDATE, DELETE, DDL, migration, SequelizeMeta write, controlled
  apply or E2 run.

## 2. Manifest / disposition contract (repository, `3dd78c4`)

| Disposition | Production manifest | Staging manifest |
|---|---:|---:|
| ATTESTED_PRESENT | 179 | 179 |
| EXCLUDED_UNSAFE | 6 | 6 |
| EXCLUDED_SUPERSEDED | 4 | 4 |
| EXCLUDED_BY_DECISION | 5 | 2 |
| CONTROLLED_APPLY_PENDING | 3 | 3 |
| BLOCKED_DECISION | 0 | 3 (intentional rehearsal fixture) |
| **Rows** | **197** | **197** |

- The offline validator reports both manifests OK.
- Production approval state: `approvedBy: null`, `approvedAt: null`. This is
  unchanged; nothing is approved.
- Decision-excluded rows in production:
  - `20260616000002` → DR-21
  - `20260618000004` → DR-06
  - `20260620000005` → DR-06

## 3. Production migration ledger (fresh)

| Item | Fresh 2026-10-05 | 2026-10-02 |
|---|---:|---:|
| SequelizeMeta rows | 26 | 26 |
| Distinct / duplicates | 26 / 0 | 26 / 0 |
| Ordered by name | yes | yes |
| Orphans (recorded, no file) | 0 | 0 |
| Repository migrations | 236 | 236 |
| Unrecorded | 210 | 210 |

The 26 recorded names equal the rehearsal fixture ledger exactly. They are 22
migrations from 2026-05 plus `20261008000001`, `20261009000001`,
`20261009000002` and `20261010000001`.

How the 236 migrations break down: 26 recorded + 197 manifest rows + 13 E2
candidates. There is no overlap and nothing is uncovered. No recorded name is
a manifest row, and no E2 candidate is recorded.

SequelizeMeta is a do-not-execute ledger. A recorded name is not evidence
that the migration's effects were executed, and an unrecorded name is not
evidence that its effects are absent.

## 4. Production schema (fresh vs 2026-10-02)

| Catalog | Fresh | 2026-10-02 | Added / removed / changed |
|---|---:|---:|---|
| Tables (public) | 119 | 119 | 0 / 0 / 0 |
| Columns (type, nullability, default, precision) | 1738 | 1738 | 0 / 0 / 0 |
| NOT NULL flags | 1738 | 1738 | 0 / 0 / 0 |
| Indexes (full definition) | 278 | 278 | 0 / 0 / 0 |
| Constraints (full definition) | 271 | 271 | 0 / 0 / 0 |
| Enum types / labels | 53 / 225 | 53 / 225 | 0 / 0 / 0 |

The comparison is row by row on the full catalog rows. The schema is
identical to 2026-10-02.

The 14 data-only queries that can be compared directly also return identical
results:
- member total
- tax_config audit types
- seed users present / count
- role by type / total / isSystem / createdBy NULL / menu sizes
- supplier_product count
- order publicToken
- cash_register status / open by store
- journal tables

Member duplicate groups: name, phone, email and store+name are all 0, as on
2026-10-02.

Known-gap recheck (fresh):

| Object | State |
|---|---|
| `tenant_membership.reactivatedAt` | ABSENT |
| `auditLog.actorType` / `tenantId` / `result` / `requestId` / `reason` / `source` / `metadata` | all 7 ABSENT; index `auditlog_tenant_createdat` ABSENT |
| `user.disabledAt`; tables `tenant`, `tenant_membership`, `store_assignment`, `authorization_context_session`; `location.tenantId` | present |
| `stock_transfer.idempotencyKey` + `stock_transfer_fromstore_idempotency_unique` | ABSENT; `stock_transfer_item.qty` int4 |
| D-05 member uniqueness (`uq_member_store_name_ci`, `uq_member_global_name_ci`, `uq_member_phone_e164`, `uq_member_email_ci`) | ABSENT (`member_pkey` only) |
| region indexes (`region_code_unique`, `region_level_idx`, `region_parent_code_idx`) | ABSENT (`region_pkey` only) |
| product_review `(productId, store)` and `(store)` | ABSENT (`product_review_pkey`, `uq_product_review_device` only) |
| `split_bill.status` | nullable (`enum_split_bill_status`, default `'pending'`) |
| `purchase_order.finalAmount`, `goods_receipt_item.qtyReceived`, `product.stock`, `product_store_stock.stock` | int4 (not BIGINT / DECIMAL) |

## 5. E2 candidates (13, read-only effect check; none executed)

| Migration | Fresh effect | 2026-10-02 | Drift |
|---|---|---|---|
| 20260613000003-insert-default-roles | PARTIAL: super_admin, admin and user role types present; `kasir` absent | same (kasir absent) | none |
| 20260810000002-add-goods-request-menu-access | EFFECT_ABSENT (no role has `goods-request`) | same schema/role rows | none |
| 20260827000004-add-my-shift-access-menu | EFFECT_ABSENT (no role has `my-shift`; 0 users with `shift` but no `my-shift`) | same | none |
| 20260902000002-add-business-trip-menu-access | EFFECT_ABSENT | same | none |
| 20261001000001-purchase-monetary-bigint | EFFECT_ABSENT (all 10 columns int4) | same | none |
| 20261001000002-goods-receipt-item-qty-decimal | EFFECT_ABSENT (`qtyReceived` int4) | same | none |
| 20261001000003-goods-receipt-idempotency | PARTIAL (`goods_receipt.idempotencyKey` present; `goods_receipt_po_idempotency_unique` absent) | same | none |
| 20261002000001-fractional-stock-decimal | EFFECT_ABSENT (6 columns int4; both non-negative CHECKs already present) | same | none |
| 20261004000001-stock-opname-decimal | EFFECT_ABSENT (10 columns int4) | same | none |
| 20261006000001-stock-transfer-idempotency-decimal | EFFECT_ABSENT | same | none |
| 20261007000001-add-dr20-foundation-fields-to-audit-log | EFFECT_ABSENT (7 columns + index) | same | none |
| 20261011000001-add-reactivated-at-to-tenant-membership | EFFECT_ABSENT | same | none |
| 20261012000001-d05-member-identity-uniqueness | EFFECT_ABSENT. Preflight data: 4 active members, 0 name groups, 0 email groups. Phone canonical collisions are NOT_VERIFIABLE_READ_ONLY in SQL (they need `canonicalPhone`). | same | none |

Carried-forward risk: this is a static reading, not an observation, and it
did not change. If replayed, `20260613000003` would insert the missing
`kasir` role with `createdBy: 'system'`, but production `role.createdBy` is
int4. Whether that insert succeeds in production is not proven; on 2026-10-02
this was recorded as "guard-path success … NOT proven". This must be resolved
before E2 execution. It does not affect D-06 approval.

## 6. Controlled-apply candidates (3)

| Migration | Fresh production state | Manifest expectation (W-02R.3R E3) | Assessment |
|---|---|---|---|
| 20260812010000-create-region-table | Table present (about 91.6k rows estimated); only `region_pkey`; the 3 indexes are absent | same | CONTROLLED_APPLY_PENDING remains accurate |
| 20260829000001-create-product-review-table | Table present; `product_review_pkey` and `uq_product_review_device` only; `(productId, store)` and `(store)` absent | same | remains accurate |
| 20260906000004-split-bill-hardening | `status` nullable; `idempotencyKey` and `split_bill_order_idempotencykey` present; table has 0 rows, so **0 rows violate** a future NOT NULL | same | remains accurate (only the SET NOT NULL effect is missing) |

## 7. Decision facts

- **DR-21** (`20260616000002`): `tax_config.createdBy` and `modifiedBy` are
  `integer` (int4), nullable, with no default. This is identical to
  2026-10-02 and consistent with `db/models/taxConfig.js` (INTEGER). The
  decision stands, and the migration was not executed.
- **DR-06** (`20260618000004`, `20260620000005`):
  - Seed usernames present: `angga` and `surya` (super_admin, active).
    Absent: `fabiola.rosa` and `dev`. This is identical to 2026-10-02.
  - A replay would therefore still insert `fabiola.rosa` (via
    `20260618000004`) and `dev` (via `20260620000005`) as global super_admins
    with credentials committed to source. EXCLUDED_BY_DECISION stays correct.
    Neither migration was executed.
  - No password, hash or token was read.
- **Approval state:** `approvedBy` and `approvedAt` are both `null`. No
  approval is recorded.

**NEW UNKNOWN (first measurement, not drift).** `user.roleType =
'super_admin'` currently has **6** accounts: all 6 active, all global
(`store IS NULL`), none soft-deleted. There are 11 users in total, and the
breakdown by roleType is super_admin 6, admin 2, user 3.

The 2026-10-02 capture did not run this aggregate, so no earlier baseline
exists. The comparable facts are unchanged:
- user total is 11
- the user table's estimated row count and size are identical
- the seed-name set is identical

This number does not affect any migration disposition. It matters for the
separate P0 remediation of seeded and default privileged accounts. It was
not acted on here.

## 8. Drift classification

| Area | Classification |
|---|---|
| SequelizeMeta (26, same names) | NO MATERIAL DRIFT |
| Repository migration universe (236) | NO MATERIAL DRIFT |
| Schema catalog (tables/columns/indexes/constraints/enums) | NO MATERIAL DRIFT (identical) |
| Comparable data-only facts | NO MATERIAL DRIFT (identical) |
| E2 candidate effects (13) | NO MATERIAL DRIFT |
| Controlled-apply preconditions (3) | NO MATERIAL DRIFT |
| DR-21 facts | NO MATERIAL DRIFT |
| DR-06 facts (seed presence) | NO MATERIAL DRIFT |
| Production approval state | NO MATERIAL DRIFT (unapproved) |
| super_admin population = 6 global active | NEW UNKNOWN (no prior baseline; disposition-neutral; P0 input) |

**Verdict: FRESH PRODUCTION EVIDENCE CAPTURE COMPLETE — NO MATERIAL DRIFT.**

**Next gate:** formal D-06 approval. Stamping, controlled applies and E2
remain separately authorized actions. They are not performed or authorized
by this record.
