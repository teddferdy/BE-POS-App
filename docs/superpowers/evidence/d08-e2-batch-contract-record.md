# D-08 E2 Batch Contract (Option C)

This is a durable engineering/release record for how the D-08 E2 inventory is
executed in production. It is **not** a business decision and adds no `DR-xx`
entry. The BA decision register (`POS-MASTER-BUSINESS-ANALYSIS.md` §35) is
unchanged.

- Recorded in repository: 2026-10-07
- Decision class: engineering / release safety (D-08 migration governance)
- Decision: **Option C — separately approved, bounded E2 batches** (locked by
  the release owner on 2026-10-07)
- Production manifest (`db/migration-dispositions/production.json`,
  sha256 `7a0f19cb…`): **unchanged**
- Production `SequelizeMeta`: **unchanged** (26 rows at the time of recording)
- Batch execution: **not authorized** by this record. Every batch needs its
  own explicit execution approval.

## 1. Why the E2 scope changed (correction of the "13 E2" statements)

E2 is derived, not listed: repository migration files − manifest rows − the
26-row ledger fixture (`scripts/rehearse-staging.js`, `deriveRehearsalSets`).

- Before PR #168 (a5deb07): 236 = 197 + 26 + **13**. `RELEASING.md`, the
  Phase 27.6 evidence and the W-02R.4 rehearsal describe these 13.
- PR #168 (`15bab08`, merged as `188ee16`) added four Payment P1 migrations
  (M1, M2, M3, M5). The derivation became 240 = 197 + 26 + **17**. The
  rehearsal constants and tests were updated, but no D-08 scope review was
  recorded and `RELEASING.md` still said 13.
- Being merged to `master` did **not** approve those four for production.
  DR-23 (§35.10) leaves "column, constraint and migration shape" to "the BE
  production migration gate", and the PR #168 description states that M3 was
  not rolled out.

The historical evidence files (Phase 27.6, W-02R.3R, W-02R.4) are correct for
the repository state they captured and are not rewritten. This record
supersedes their "13 E2" scope for planning purposes from 2026-10-07.

## 2. Why one unbounded run is unsafe

1. `npm run migrate` ran `sequelize-cli db:migrate` for **every** pending
   migration in filename order; the runner accepted only `--env`.
2. M3 (`…canonical-payment-check`) sorted **between** M2 and M5. M5 (and M1)
   add the columns the P1 application reads, so P1 cannot be deployed before
   them, and an in-order run applies M3 before P1 can be deployed.
3. The application currently in production (a5deb07) writes non-canonical
   `transaction.typePayment` values (`paymentMethod || 'cash'` in
   `api/controller/order.js`, `splitBill.js`, `salesReturn.js`). M3's CHECK
   accepts only `CASH, CARD, BANK_TRANSFER, E_WALLET, QRIS, POINTS, OTHER`, so
   applying M3 while a5deb07 is live would refuse those payment writes.
4. The P1 runtime references no M2 or M3 database object; it needs only the
   M1 and M5 columns.

## 3. Decision

| Batch | Migrations | Precondition gate | Afterwards |
|---|---|---|---|
| **B1** | Original E2 #1–#13 (`20260613000003` … `20261012000001`) | **DR-22** (legacy `kasir` provisioning by `20260613000003`) must be decided — it is DEFERRED | verify B1 |
| **B2** | P1 M1 `20261013000001-p1-transaction-attribution`, M2 `20261013000002-p1-transaction-linkage-fks`, M5 `20261013000004-p1-register-close-snapshot` | B1 recorded; B2 execution approval | verify B2 → deploy/promote P1 code → verify canonical payment writes |
| **B3** | M3 `20261013000005-p1-canonical-payment-check` only | **P1-CANONICAL-WRITES-VERIFIED**: P1 live in production and canonical writes verified | verify B3 |

- **M3 is renamed** from `20261013000003-p1-canonical-payment-check.js` to
  `20261013000005-p1-canonical-payment-check.js` so the runner order is
  M1 → M2 → M5 → M3. The file content is byte-identical (pure rename). M3 was
  never applied to production or any shared database; only disposable test,
  CI and rehearsal databases ran it.
- **M6** (`VALIDATE CONSTRAINT` for M3) remains separately deferred and is
  not part of any batch.
- No batch is approved by existing in the repository. Each batch needs its
  own explicit execution approval, a restore point, and fresh read-only
  preconditions before it runs.

## 4. Mechanism

- `scripts/migration-batches.js` holds the frozen contract: exact filenames
  per batch, the expected count, and the open governance gates.
- `npm run migrate -- --env production --batch B1|B2|B3`
  (`scripts/run-migrations.js`):
  1. The D-08 preflight runs first and is unchanged and authoritative
     (manifest approved and fully stamped, no blocked or pending
     dispositions, no orphan rows).
  2. The batch is evaluated against the same files and `SequelizeMeta`
     snapshot. It refuses an unknown batch, missing files, an unsorted,
     reversed or duplicated contract, a count mismatch, a member already
     recorded, any pending migration outside the batch that would run first
     (non-contiguous range or unstamped ledger), and any open gate.
  3. Only then is `sequelize-cli db:migrate --to <last member>` started.
     Because the pending list is proven to start with exactly the batch,
     `--to` executes exactly the batch.
  4. `SequelizeMeta` is re-read read-only afterwards and must have gained
     exactly the batch. Anything else is a `POST-RUN LEDGER MISMATCH` (exit 1).
- In a disposition-governed environment (production, staging) an unbatched
  `npm run migrate` is refused while any batch member is pending, so all 17
  cannot run by accident. Local development (no manifest) is unchanged.
- There is no free-form `--from`/`--to`/`--name`. Clearing a gate or changing a
  batch is a reviewed change to `scripts/migration-batches.js` that cites its
  decision or evidence.

## 5. D-08-EXC-01 (historical, closed)

- 2026-10-07: one-off exception, explicitly approved, limited to adding
  `public.tenant_membership."reactivatedAt" TIMESTAMP WITH TIME ZONE NULL
  DEFAULT NULL` in production. It was run by the release owner in the Neon
  SQL editor (branch `production`, database `neondb`).
- Verified: the column is present with exactly that definition;
  `SequelizeMeta` = 26; `20261011000001-add-reactivated-at-to-tenant-membership.js`
  is **not recorded**; `tenant_membership` rows = 0; `GET /auth/context`
  returns 200 on a5deb07. Status: **CLOSED — PASS**.
- `20261011000001` stays in **B1** unchanged. When B1 runs, its existing
  column guard (`existingColumns` → no `addColumn`) makes it a no-op and the
  runner records it normally. It must **not** be stamped manually.
- Until B1 records it, the production schema and `SequelizeMeta` are
  deliberately out of sync for this one migration.
- EXC-01 is **not a precedent**. Any further production DDL outside the
  batches needs its own explicit exception record and approval.

## 6. Status at recording

| Item | Status |
|---|---|
| D-08-EXC-01 | CLOSED — PASS |
| B1 | NOT APPROVED FOR EXECUTION (blocked by DR-22) |
| B2 | NOT APPROVED FOR EXECUTION (requires B1) |
| B3 | NOT APPROVED FOR EXECUTION (blocked until P1 canonical writes are verified) |
| DR-22 | OPEN (DEFERRED 2026-10-05) |
| P1 production deployment | BLOCKED until B2 is executed and verified |
| M3 production execution | BLOCKED until P1 is live with canonical writes verified |
| Production execution of any batch | NOT EXECUTED |

Before B1 can run, the existing D-08 steps still apply in order: stamping the
approved manifest (separately authorized, SHA-pinned) and the three
controlled applies.

## 7. Traceability

- Manifest and dispositions: `db/migration-dispositions/README.md`,
  `production.json`
- Runner and preflight: `scripts/run-migrations.js`,
  `scripts/check-migration-preflight.js`
- Contract: `scripts/migration-batches.js`; tests
  `__tests__/migration-batches.test.js`
- Evidence: `phase27-6-fresh-production-evidence-2026-10-05T13-09-47Z.md` (13 E2
  effect table), `e2-role-migration-down-safety-record.md`
- Decisions: DR-22 (§35.9), DR-23 (§35.10)
