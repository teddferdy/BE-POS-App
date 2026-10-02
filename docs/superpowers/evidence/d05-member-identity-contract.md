# D-05 Member Identity Uniqueness — Decision & Technical Contract Record

This is a durable repository record of the **already-locked** D-05 business
decision and final technical contract (D-05 Final Technical Contract §18 and
the D-05 Implementation Discovery, sections D–J). It records the decision; it
does not make one, and it does not authorize production migration.

- Decision reference: `D-05` (disposition `decisionRef`: `D-05 member uniqueness`)
- Status: LOCKED (business decision and technical contract closed)
- Recorded in repository: 2026-10-03
- Production manifest approval: **not granted** (`approvedBy` / `approvedAt`
  remain `null` in `db/migration-dispositions/production.json`)
- Staging manifest approval: **not granted** (`null` in `staging.json`)
- W-02 / G-02: not passed by this record

## 1. Decision Linkage

| Item | Value |
|---|---|
| Superseded historical migration | `20260620000004-add-unique-constraints-to-member.js` → `EXCLUDED_BY_DECISION` (D-05) |
| Superseded historical migration | `20260913000001-member-name-store-scoped-uniqueness.js` → `EXCLUDED_BY_DECISION` (D-05) |
| Owning migration (sole owner of the target model) | `db/migrations/20261012000001-d05-member-identity-uniqueness.js` (E2: runs through the runner, not a manifest row) |
| Prior evidence (pre-decision observation) | `docs/superpowers/evidence/w02r3r-report-2026-10-02T12-09-42Z.md` §5 "D-05 (member uniqueness)"; `docs/superpowers/evidence/w02r3r-matrix-v2-reconstructed-2026-10-02T12-09-42Z.json` (E6) |
| Canonicalization implementation | `utils/memberIdentity.js` |

Pre-decision production observation (W-02R.3R): `member` carries only
`member_pkey`; `uq_member_name` / `uq_member_phoneNumber` / `uq_member_email`
and the C13 objects are absent; member total 4; raw name/phone/email/store-name
duplicates 0. Neither historical migration was executed in production.

## 2. Business Contract

- **Name**: unique per store, case- and surrounding-whitespace-insensitive.
  Different stores may reuse a name. Global members (`store IS NULL`) form one
  global bucket, disjoint from every store bucket.
- **Phone**: one customer identity per real phone number across the whole
  system (global, not per store). National and international spellings of the
  same number are the same identity.
- **Email**: globally unique, case- and surrounding-whitespace-insensitive;
  optional.
- **Guest**: a member registered without a phone receives a server-generated
  placeholder identifier that never participates in phone identity.
- **Soft delete**: a soft-deleted member releases its name, phone, and email.
- Legacy data is never silently coerced, deduplicated, renamed, or deleted.

## 3. Technical Contract

### 3.1 Canonicalization

| Field | Canonical identity | Storage |
|---|---|---|
| name | `trim(name).toLowerCase()`; DB `LOWER(TRIM(name))` | as input |
| email | `trim(email).toLowerCase()`; DB `LOWER(TRIM(email))` | as input; `'' → NULL` |
| phone | E.164 via `libphonenumber-js`; default region `ID` for ambiguous national input; `+<cc>` input parsed region-agnostically | `member.phoneNumber` = canonical E.164 (no second identity column) |

No NFKC/NFC normalization. No hand-rolled country parsing. No citext. No
normalized shadow columns. Invalid phones are rejected, never coerced.

### 3.2 Uniqueness objects (exactly four, all partial unique indexes)

```sql
CREATE UNIQUE INDEX uq_member_store_name_ci  ON "member" (store, (LOWER(TRIM(name))))
  WHERE store IS NOT NULL AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX uq_member_global_name_ci ON "member" ((LOWER(TRIM(name))))
  WHERE store IS NULL AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX uq_member_phone_e164     ON "member" ("phoneNumber")
  WHERE "deletedAt" IS NULL AND "phoneNumber" NOT LIKE 'GUEST-%';
CREATE UNIQUE INDEX uq_member_email_ci       ON "member" ((LOWER(TRIM(email))))
  WHERE "deletedAt" IS NULL AND email IS NOT NULL;
```

### 3.3 Guest rules

- Generator: `GUEST-` + Node built-in `crypto.randomUUID()`. `GUEST-${Date.now()}`
  is retired.
- Server-generated only: a client-supplied `GUEST-*` value is rejected (HTTP
  400) on create; on update it is accepted only when it equals the member's
  current value (no-op).
- Guests are excluded from phone uniqueness by the index predicate. No guest
  flag, no guest lifecycle, no claim/convert flow.

### 3.4 Soft-delete rules

All four objects carry `"deletedAt" IS NULL`. No restore feature.

## 4. Migration Behavior (`20261012000001`)

1. Runs entirely inside its own Sequelize transaction (the repository runner
   provides none); every statement, including the existence probe, receives it.
2. Preflight (SELECT-only) before any DDL or data rewrite:
   - every active non-guest phone must parse to E.164;
   - no canonical phone collision (global, active);
   - no canonical name collision per bucket (store / global, active);
   - no canonical email collision (global, active, non-NULL).
3. Any failure aborts with `D05_PREFLIGHT_ABORT` (counts only, no values) and
   the transaction rolls back: no DDL, no rewrite, no partial state.
4. After a successful preflight: active non-guest phones are rewritten to
   E.164. Guests, soft-deleted rows, names, emails, and `order.customerPhone`
   are never rewritten.
5. Superseded historical objects (20260620000004 constraints, C13 constraint
   and index) are dropped only if present (existence-checked).
6. The four target indexes are created (never `CONCURRENTLY`).
7. `down` drops only the four D-05 indexes; it never un-canonicalizes phones,
   restores names, or resurrects historical constraints.

No automatic survivor selection, rename, delete, or revival of the historical
rename-based deduplication.

### Production legacy-phone preflight behavior

The D-05 implementation discovery identified four legacy 8-character phone
values in production. They do not parse as valid phone numbers, so the
production migration preflight is **expected to abort** until an operator
classifies those rows. This is intended fail-closed behavior; it must not be
weakened, and the values must not be silently coerced.

## 5. Application Behavior

- Create/update prechecks evaluate both sides with the index expression
  (`LOWER(TRIM(...))`), names within the own store or global bucket, phone and
  email globally; update excludes the member's own id. The DB index is the
  final arbiter.
- DB unique violations (precheck/write races) map to HTTP 409 by index name
  with the existing vocabulary: `Nama member sudah terdaftar`,
  `Nomor telepon sudah terdaftar`, `Email sudah terdaftar`.
- Invalid phone → HTTP 400 `Nomor telepon tidak valid` (Zod boundary and
  controller share one parser). Missing/empty/whitespace-only phone on create →
  server-generated guest; on update → phone unchanged.
- Points adjustment (`/member/edit-point-member/:phoneNumber`) canonicalizes
  the path value before the exact lookup; a server-generated `GUEST-*` value
  matches exactly; any other unparseable value never matches by phone (the
  numeric member-id lookup is unchanged).
- Invoice member join: `order.customerPhone` stays historical/raw; it is
  canonicalized at comparison time and matches only canonical
  `member.phoneNumber`; unparseable historical values never join.
- Admin/POS phone search keeps the raw substring match and adds the
  library-derived E.164 prefix for phone-shaped input (`0812` → `+62812`).

## 6. Test Expectations

- `__tests__/member-identity-uniqueness.test.js`: name/phone/email/guest/soft
  delete HTTP contract, DB race → 409 messages (create and update), update
  validation and self-exclusion, points-adjustment lookup, invoice join,
  phone search.
- `__tests__/d05-member-identity-migration.test.js` (disposable local database
  only): clean path and backfill, preflight aborts (unparseable phone, phone /
  store-name / global-name / whitespace-name / email collisions) with no DDL
  and no data rewrite, exact index definitions, historical object cleanup,
  `down` scope.
- Accounting: 236 repository migrations = 197 manifest rows + 26 ledger rows +
  13 E2; manifest dispositions include 3 `BLOCKED_DECISION` and 2
  `EXCLUDED_BY_DECISION`.
