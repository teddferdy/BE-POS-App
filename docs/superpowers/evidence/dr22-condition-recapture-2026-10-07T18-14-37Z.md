# DR-22 Condition Evidence Recapture (read-only)

Fresh read-only production evidence for the DR-22 `CONDITIONAL AUTHORIZATION`
(`docs/superpowers/evidence/dr22-conditional-authorization-record.md`).
Evidence only: it does not clear the DR-22 gate, authorize B1, stamp the
manifest, or change any decision. Historical records are unchanged.

- Capture window (UTC): 2026-10-07T18:14:32Z – 2026-10-07T18:14:37Z
- Mechanism: repo `withReadOnlyTransaction()`
  (`scripts/check-production-schema.js`) — `BEGIN; SET TRANSACTION READ
  ONLY` as the first statement; inside the transaction
  `SHOW transaction_read_only` returned `on`. Every query was a SELECT.
  No INSERT/UPDATE/DELETE/DDL/migration/SequelizeMeta write.
- No secrets captured: role rows carry no credentials; users reported as
  aggregates by `roleType` only (no usernames, hashes, or tokens).

## 1. Role state (4 rows, ordered by id)

| id | roleType | name | isSystem | createdBy | status |
|----|------------|---------------|----------|-----------|--------|
| 1 | super_admin | Super Admin | true | null | active |
| 2 | admin | Admin Toko | true | null | active |
| 3 | user | Staff/Karyawan | true | null | active |
| 4 | user | Finance | false | 1 | active |

`kasir` is absent. No duplicate `roleType` state. `role.isSystem` column
present, so the migration's `describeTable` branch would insert with
`isSystem: true`.

## 2. User state (counts only, 11 total)

| roleType | n |
|------------|---|
| super_admin | 6 |
| admin | 2 |
| user | 3 |

`kasir` users: 0.

## 3. Migration ledger

`SequelizeMeta`: 26 rows, ordered by name, no duplicates observed. The 26
names equal the previously recorded fixture (22 from 2026-05 plus
`20261008000001`, `20261009000001`, `20261009000002`, `20261010000001`).
`20260613000003-insert-default-roles` is NOT recorded.

## 4. Duplicate-safety reading (static, not executed)

Against this state the migration's `roleType` guard would skip
`super_admin`, `admin`, and `user`, and insert exactly one row
(`Kasir`/`kasir`, `createdBy: null`, `isSystem: true`). Expected delta: `+1
kasir role`, `+0` otherwise. No second `kasir` row would be created on a
single guarded run.

## 5. Still open (not evidenced here)

- Product/launch role intent (Condition 1): no launch-roster artifact found;
  DR-06 roster remains OPEN.
- Restore point (Condition 4): no restore-point evidence collected or
  verified in this task.
- Expected role-state confirmation (Condition 5): blocked on Conditions 1
  and 4.
