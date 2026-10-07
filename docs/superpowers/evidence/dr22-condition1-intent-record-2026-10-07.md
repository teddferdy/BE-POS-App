# DR-22 Condition 1 Intent Decision + Conditions 4–5 Update

New evidence entry for the DR-22 `CONDITIONAL AUTHORIZATION`
(`docs/superpowers/evidence/dr22-conditional-authorization-record.md`).
It records the Condition 1 business decision, the Condition 4 operational
requirement, and the recomputed Condition 5. It does not clear the DR-22
gate, authorize any execution, or alter any historical record. DR-06
(`launch roster = OPEN launch input`, BA §35.7) is preserved as-is.

- Recorded: 2026-10-07T18:17Z (UTC).
- Authority for the Condition 1 decision: Product Owner, via explicit
  instruction conveyed in the DR-22 condition-resolution task. No person's
  name recorded (project convention has no defined owner name).

## 1. Condition 1 — explicit decision: PASS

Decision:

> `kasir/cashier is an intended launch role for the POS product and may be
> provisioned by the default-role migration.`

Rationale (as decided):

- cashier is an explicit operational actor in the designed POS workflow;
- cashier-related user stories exist;
- the role is already represented in the product's role model;
- no authoritative evidence indicates that cashier is excluded from launch;
- the remaining gap was formal launch-role confirmation, not technical
  feasibility.

Evidence references: `docs/product/BRD.md` (role model, cashier workflows);
`docs/product/PRD.md` / `USER-STORY-BACKLOG.md` (cashier user stories);
`db/models/user.js` + `db/models/role.js` (role vocabulary — vocabulary
only, not approval); BA §35.9 / DR-06 (the gap this decision closes).

Scope: satisfies Condition 1 (product/launch role intent) of the DR-22
conditional authorization only. It does not authorize migration execution,
B1, manifest stamping, controlled applies, production SQL, P1 deployment,
or Vercel promotion.

## 2. Condition 4 — restore-point requirement: OPEN

Established procedure (from project governance, not invented here):

- Each D-08 batch needs its own explicit execution approval, a restore
  point, and fresh read-only preconditions before it runs
  (`docs/superpowers/evidence/d08-e2-batch-contract-record.md` §3;
  `RELEASING.md` run-migrations step 5, `origin/master`).
- The restore point is attributable to the production database (Neon branch
  `production`, database `neondb` — identity per Phase 27.6 evidence and the
  D-08-EXC-01 record). It must be timestamped (UTC), identifiable (restore
  reference), and evidenced with retention/recoverability information and
  who/what established it, recorded before the controlled migration
  sequence.
- On restore, the ledger loses stamped dispositions; the verifier FAILs and
  the preflight refuses until the stamper (idempotent) is re-run and the
  state re-verified (`RELEASING.md` "Restore").
- Neon PITR availability alone is not claimed as verified restore-point
  evidence.

Status: `OPEN — RESTORE POINT MUST BE ESTABLISHED IMMEDIATELY BEFORE
CONTROLLED EXECUTION`. No restore point was created, modified, or evidenced
in this task, and none was found in the repository. A restore point created
now would be stale by execution time, so it is correctly left to the
pre-execution step.

## 3. Condition 5 — recomputed: PASS (execution still blocked)

Using the Condition 1 decision above and the fresh 2026-10-07T18:14Z
recapture
(`docs/superpowers/evidence/dr22-condition-recapture-2026-10-07T18-14-37Z.md`):

1. Is `kasir` intended? Yes — per the Condition 1 decision recorded above.
2. Does `kasir` currently exist? No — absent (4 role rows: super_admin,
   admin, 2× user).
3. Are there currently `kasir` users? No — 0 (11 users: 6/2/3).
4. Is the migration recorded? No — `SequelizeMeta` 26 rows, target absent.
5. If executed, how many rows expected to change? Exactly one role row
   (`Kasir`/`kasir`, `createdBy: null`, `isSystem: true`); `+0` otherwise.

`PASS — INTENDED ROLE STATE CONFIRMED; EXECUTION READINESS STILL BLOCKED BY
RESTORE-POINT CONDITION`. The DR-22 package is not execution-ready until
Condition 4 passes. The DR-22 gate in `scripts/migration-batches.js` stays
OPEN and B1 stays BLOCKED.
