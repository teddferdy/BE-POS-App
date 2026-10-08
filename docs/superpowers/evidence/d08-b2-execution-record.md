# D-08 B2 Execution Record

Factual record of the authorized production execution of batch B2
(P1 foundation: M1 + M2 + M5). This document records what happened; it
grants nothing and changes no governance state. B3 and all other migrations
remain unauthorized and unexecuted.

- Executed: 2026-10-08T17:49:23Z → 2026-10-08T17:49:27Z (UTC, ~4s)
- Environment: production `neondb` (Neon branch `production`), PostgreSQL 17.11
- Repository: `fix/d05-gate-review` @ `cd7d9eb` content, governed files
  byte-identical to origin/master `cb9ff8e` at execution
- Command (only command run): `npm run migrate -- --env production --batch B2`
- Exit code: 0

## 1. Authorization (scope as granted, not broadened)

Owner granted in-workflow, exact scope: execution of EXACTLY
[20261013000001-p1-transaction-attribution.js,
20261013000002-p1-transaction-linkage-fks.js,
20261013000004-p1-register-close-snapshot.js] via the governed batch path,
ledger 236 → 239, excluding M3/0005, all other migrations, deployments,
and manual SQL. No broader authorization exists or is inferred.

## 2. Final preconditions (fresh, read-only, immediately pre-run)

Ledger 236 with B1 13/13 + D-05 exactly once + zero duplicates (B1
re-verified per-name after catching and correcting a probe-list omission;
reported, not hidden); B2/M3 objects absent (M1/M2/M5 columns, constraints,
and indexes all confirmed absent); relevant tables empty (orphan predicates
vacuously true); ops zero (orders, transactions, registers); audit 79;
users 11; app live (`/health` ok); restore SHA re-verified exact
(`c5007d6dba152dfed9f6accc4c64ea35e6a3c55bc23b840c62fb95f2c04c4f8a`).

## 3. Restore point (execution-time, B2-specific; D-05 dump NOT reused)

`neondb-pre-b2-20261008.dump`, pg_dump 17.11 custom-format full database,
created 2026-10-08T17:48:33Z → 17:48:56Z (post-M08, pre-run), 1,618,038
bytes, SHA-256 `c5007d6dba152dfed9f6accc4c64ea35e6a3c55bc23b840c62fb95f2c04c4f8a`,
`pg_restore --list` exit 0 with 119/119 tables, zero intervening writes
re-verified post-backup (chain VALID). RESTORE_CAPABILITY = UNTESTED (no
drill performed, none claimed). Durability: LOCAL ONLY (no offsite copy
evidenced; do not treat as durable).

## 4. Runner result

Preflight OK → bounded batch (M1, M2, M5 in batch order) → each migrated
(0.42s / 0.34s / 0.33s) → "batch B2 recorded exactly",
ledgerBefore 236, ledgerAfter 239. Exit code 0. No refusal to override
(none occurred); no free-form `--to` involved (runner-internal bounding only).

## 5. Independent post-run verification (read-only)

Ledger 239: B2 three recorded exactly once each, M3 absent, zero dupes.
M1: `cashRegisterId` + `splitBillId` (INTEGER, nullable) + both indexes,
exact. M2: `transaction_cashregister_fkey` (SET NULL, NOT VALID),
`transaction_splitbill_fkey` (SET NULL, NOT VALID),
`transaction_salesreturn_fkey` (RESTRICT, NOT VALID) + lookup index, exact.
M5: all eight columns (7 INTEGER + JSONB), all nullable, zero defaults,
exact. Members 9 physical / 0 active untouched; orders/transactions zero;
audit still 79; app `/health` ok post-run; worktree clean.

## 6. Scope containment

Only B2 applied. No B3/M3, no P1 remainder, no manifest/runner/preflight
change, no deployment, no manual SQL as part of this task.

## 7. Financial-integrity boundary

B2 establishes schema foundation only (zero DML in all three migrations;
zero money-state change verified). It does NOT complete payment,
settlement, refund, register-reconciliation, or canonical-tender
correctness. The next behavioral layer requires P1 application deployment
plus canonical-write verification, then B3.

## 8. B3 boundary (preserved)

M3 / `20261013000005-p1-canonical-payment-check.js` = NOT RECORDED.
P1-CANONICAL-WRITES-VERIFIED = NOT YET CLEARED. B3 AUTHORIZATION = NO.
B3 EXECUTION = NO. M6 = DEFERRED. No B3 gate touched by anything here.

## 9. Preserved limitations

Restore capability UNTESTED; artifact local-only; deployed app commit
unpinned (liveness verified, not version); independent verifier role never
formally filled (runner's mechanical checks acted as second check; owner
authorization was explicit in-workflow); member `status` column still reads
`active` on paranoid-deleted rows (deletion state carried by `deletedAt`,
per implementation).
