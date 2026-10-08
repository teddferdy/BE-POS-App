# CAP #1 Manifest Reconciliation Record

Reconciles the repository production manifest with the already-executed and
independently verified CAP #1 production CAS transition. Governance-only:
it executes no production migration and authorizes no further operation
(CAP #2, CAP #3, B1/B2/B3, deployment, promotion all remain separately
authorized or blocked).

- Migration: `20260812010000-create-region-table.js`
- Transition: `CONTROLLED_APPLY_PENDING` → `CONTROLLED_APPLIED`
- applyRef: `controlled-apply/20260812010000-create-region-table.js/2026-10-08T03:39:46.213Z/teddy-ferdian`
- Authorized manifest SHA (pre-CAS): `7a0f19cbcd68fc76fd166a9aa0043e9a1bb24f04c65d4108a666e02abf095ebd`
- Resulting manifest SHA (post-CAS): `d9773ddff85cfa7e8882c80af5e7c2a257203707ae2f14734d16f6b817139f52`
- Execution window (UTC): 2026-10-08T03:39:46.213Z – 2026-10-08T03:39:46.868Z
- Production identity: Neon branch `production`, database `neondb`, role `neondb_owner`, PostgreSQL 17.11
- Schema effects (verified in-transaction): `region_code_unique` (UNIQUE, `code`),
  `region_level_idx` (`level`), `region_parent_code_idx` (`parentCode`)
- Gate-6 preconditions at execution: region table + `code`/`level`/`parentCode`
  columns present, 0 duplicate `code` groups (evidence: CAP #1 applied-evidence
  record, dry-run evidence, Gate-7 backup evidence retained by the operator)
- Authorization ref: `D08-CAP1-20261008-region`; operator: `teddy-ferdian`
- Disposition counts after reconciliation: 197 rows; ATTESTED_PRESENT 179;
  EXCLUDED_UNSAFE 6; EXCLUDED_BY_DECISION 5; EXCLUDED_SUPERSEDED 4;
  CONTROLLED_APPLIED 1; CONTROLLED_APPLY_PENDING 2; BLOCKED_DECISION 0
- Remaining pending: `20260829000001-create-product-review-table.js`,
  `20260906000004-split-bill-hardening.js` (B1 still refused by exactly these two)

## Re-approval

The file-level `approvedBy`/`approvedAt` (`teddy-ferdian` /
2026-10-05T16:57:23Z) are carried over unchanged, so the reconciled bytes
hash to exactly the post-CAS SHA above (validator: `ok:true approved:true`).
Re-approval of the new SHA is recorded by the reconciling PR itself: the
commit message and PR description bind approval to the exact new SHA and the
exact one-row delta. This re-approval covers manifest accuracy only.

## Test consequences (mechanical, reviewed in the same PR)

- `migration-dispositions`: locked counts move PENDING 3 → 2, APPLIED 0 → 1
- `migration-preflight` (×2) and `production-schema-verifier`: pending-count
  assertions move `(3)` → `(2)`; refusal behavior unchanged
- `staging-rehearsal` divergence helper: a verified production
  controlled-apply progression (staging PENDING without applyRef vs
  production APPLIED with a `controlled-apply/` applyRef, all other fields
  identical) is no longer reported as unexpected divergence; every other
  difference still fails closed. Staging rehearsal semantics are unchanged.
