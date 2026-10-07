# DR-22 Conditional Authorization — Decision Record

This is the durable repository record of the DR-22 product/business decision
for `20260613000003-insert-default-roles`. It records a decision; it does
not execute any migration and does not authorize any operational step beyond
DR-22 eligibility subject to the conditions below.

- Migration: `20260613000003-insert-default-roles`
- Decision: `CONDITIONAL AUTHORIZATION`
- Authority: Product Owner, via explicit delegation to the most proper,
  evidence-based option, conveyed in the DR-22 final-decision task
  instruction. No person's name recorded (project convention has no defined
  owner name).
- Decision date: 2026-10-07 (UTC).
- Effective scope: DR-22 eligibility for this one migration only. It does not
  authorize manifest stamping, controlled applies, B1/B2/B3 execution,
  production SQL, P1 deployment, or Vercel promotion.
- Prior state (preserved, not rewritten): DR-22 `DEFERRED 2026-10-05`
  (`POS-MASTER-BUSINESS-ANALYSIS.md` §35.9; register row §35/§35.7;
  `docs/product/OPEN-BUSINESS-QUESTIONS.md`). No authorization or prohibition
  existed before this record.

## 1. Rationale (as decided)

The migration is technically suitable for controlled execution: it is
data-only; it only inserts missing default role rows; it is guarded by
existing `roleType` checks; the expected production delta from the last
evidence was only the missing `kasir` role; it has been tested for empty,
partially populated, production-shaped, and rerun scenarios
(`__tests__/staging-rehearsal.test.js`); its `down` migration is
intentionally a no-op (forward-only,
`docs/superpowers/evidence/e2-role-migration-down-safety-record.md`); it has
no dependency on the P1 schema migrations; current application runtime does
not require the `kasir` row merely to boot.

However, the existence of the `kasir` role is a product/business decision
rather than a purely technical requirement, so unconditional authorization
would be unjustified. Conditional authorization allows the migration to
proceed only after the intended production role state and current production
state are explicitly confirmed.

## 2. Conditions (must be satisfied before B1 execution)

| # | Condition | Evidence required |
|---|---|---|
| 1 | Product intent: confirm `kasir` / cashier is part of the intended launch/product role roster (DR-06 / launch-roster evidence if available; never inferred from code alone) | Roster / product confirmation artifact |
| 2 | Fresh READ-ONLY production recapture immediately before operational authorization: `kasir` role present/absent, `kasir` user count, existing `super_admin` / `admin` / `user`, relevant `isSystem` state, `SequelizeMeta`, target migration still unrecorded. The 2026-10-05 evidence is historical and must not be treated as current. No mutation during recapture | Fresh read-only capture artifact (SELECT-only, no secrets) |
| 3 | Duplicate safety: freshly verify the insertion cannot create an unintended duplicate under the current state, consistent with the guarded `roleType` behavior. On unexpected duplicate state: STOP, do not execute B1 | Duplicate-check evidence from the fresh recapture |
| 4 | Restore point established/confirmed immediately before the controlled migration sequence, with sufficient evidence to identify it. No production modification in this step | Restore-point identifier / evidence |
| 5 | Explicit role-state confirmation before execution: if `kasir` absent, B1 may create exactly the missing default `kasir` role; if present, the migration must not create another. No assumption about production state | Pre-execution confirmation tied to Condition 2 |

## 3. Status at recording (2026-10-07)

All five conditions are `OPEN`: no launch-roster confirmation, no fresh
recapture, no duplicate check, no restore point, and no role-state
confirmation exist in the repository at the time of recording. The 2026-10-05
Phase 27.6 evidence is explicitly historical for this purpose.

Consequence: the DR-22 governance gate in `scripts/migration-batches.js`
remains `OPEN`, B1 remains `BLOCKED`, and no gate-clear change, test change,
stamp, controlled apply, batch execution, deployment, or promotion is
authorized by this record.

## 4. Traceability

- Prior deferral: BA §35.9 (2026-10-05), register §35/§35.7, OPEN-BUSINESS-QUESTIONS.md
- Discovery: DR-22 decision package (read-only; recommendation not a decision)
- Batch contract: `docs/superpowers/evidence/d08-e2-batch-contract-record.md`,
  `scripts/migration-batches.js` (B1 `openGates: [DR-22]`, unchanged)
- Safety: `docs/superpowers/evidence/e2-role-migration-down-safety-record.md`
- Last production evidence (historical):
  `docs/superpowers/evidence/phase27-6-fresh-production-evidence-2026-10-05T13-09-47Z.md`
- Manifest: `db/migration-dispositions/production.json` (unchanged by this record)
