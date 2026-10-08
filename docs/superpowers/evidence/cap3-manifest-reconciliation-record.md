# CAP #3 Manifest Reconciliation Record

Reconciles the repository production manifest with the already-executed and
independently verified CAP #3 production CAS transition. Governance-only:
it executes no production migration and authorizes no further operation
(B1/B2/B3, deployment, promotion all remain separately authorized or
blocked).

- Migration: `20260906000004-split-bill-hardening.js`
- Transition: `CONTROLLED_APPLY_PENDING` → `CONTROLLED_APPLIED`
- applyRef: `controlled-apply/20260906000004-split-bill-hardening.js/2026-10-08T06:05:56.996Z/teddy-ferdian`
- Authorized manifest SHA (pre-CAS): `372d0c49612c9a74243721c6be599a50fc833e29f8caa74da18b76a8388e6b66`
- Resulting manifest SHA (post-CAS): `0a3ea589bd8a4f930a08b443d5f7792e0d9f876e16d37c2da58341a88ed49589`
- Execution window (UTC): 2026-10-08T06:05:56.996Z – ~2026-10-08T06:06:00Z
- Production identity: Neon branch `production`, database `neondb`, role `neondb_owner`, PostgreSQL 17.11
- Schema effects (verified in-transaction): `split_bill.status` SET NOT NULL
  (`is_nullable=NO`), `split_bill.idempotencyKey` present,
  `split_bill_order_idempotencykey` present and non-unique; 0 NULL rows
- Gate-6 preconditions at execution: `split_bill` + `status` present, 0 NULL
  status rows, `order` present, 0 orphans; dry-run PASS with exit 0
- Authorization ref: `D08-CAP3-20261008-split-bill`; operator: `teddy-ferdian`
- Backup: fresh `pg_dump` custom-format full-database (pg_dump 17.11,
  1606703 bytes, 2026-10-08T06:05:43Z), Gate-7 verified PASS, restore
  UNTESTED (no drill performed, no capability overstated)
- Artifact note: the post-CAS file was first mis-copied from the wrong
  checkout during the CAP #3 execution task and its temp-worktree original
  removed before the error was noticed (no production impact: DDL and
  evidence already durable). It was recovered by deterministically
  re-running the tooling's exact CAS serialization on the verified base
  bytes with the verified applyRef; output SHA matches the recorded
  `resultingManifestSha` exactly. This reconciliation independently
  re-verified the recovered artifact (SHA, rows, dispositions, applyRefs)
  before use.
- Disposition counts after reconciliation: 197 rows; ATTESTED_PRESENT 179;
  EXCLUDED_UNSAFE 6; EXCLUDED_BY_DECISION 5; EXCLUDED_SUPERSEDED 4;
  CONTROLLED_APPLIED 3; CONTROLLED_APPLY_PENDING 0; BLOCKED_DECISION 0
- Remaining pending: none (B1's controlled-apply blocker is cleared; B1
  itself still needs its own authorization + restore + fresh preconditions)

## Re-approval

The file-level `approvedBy`/`approvedAt` (`teddy-ferdian` /
2026-10-05T16:57:23Z) are carried over unchanged, so the reconciled bytes
hash to exactly the post-CAS SHA above (validator: `ok:true approved:true`).
Re-approval of the new SHA is recorded by the reconciling commit message +
PR review. This re-approval covers manifest accuracy only.

## Test consequences (mechanical, reviewed in the same PR)

- `migration-dispositions`: locked counts move PENDING 1 → 0 (key absent),
  APPLIED 2 → 3
- `migration-preflight` and `production-schema-verifier`: pending-based
  refusal assertions are re-expressed with a synthetic PENDING fixture so
  the fail-closed gate stays covered now that the real manifest has no
  pending rows
- `staging-rehearsal` divergence helper (from the CAP #1 reconciliation)
  already tolerates verified controlled progression generically — unchanged
