# CAP #2 Manifest Reconciliation Record

Reconciles the repository production manifest with the already-executed and
independently verified CAP #2 production CAS transition. Governance-only:
it executes no production migration and authorizes no further operation
(CAP #3, B1/B2/B3, deployment, promotion all remain separately
authorized or blocked).

- Migration: `20260829000001-create-product-review-table.js`
- Transition: `CONTROLLED_APPLY_PENDING` → `CONTROLLED_APPLIED`
- applyRef: `controlled-apply/20260829000001-create-product-review-table.js/2026-10-08T04:34:00.295Z/teddy-ferdian`
- Authorized manifest SHA (pre-CAS): `d9773ddff85cfa7e8882c80af5e7c2a257203707ae2f14734d16f6b817139f52`
- Resulting manifest SHA (post-CAS): `372d0c49612c9a74243721c6be599a50fc833e29f8caa74da18b76a8388e6b66`
- Execution window (UTC): 2026-10-08T04:34:00.295Z – 2026-10-08T04:34:00.730Z
- Production identity: Neon branch `production`, database `neondb`, role `neondb_owner`, PostgreSQL 17.11
- Schema effects (verified in-transaction): `product_review_product_store`
  (`productId`, `store`, non-unique), `product_review_store` (`store`,
  non-unique); pre-existing `product_review_pkey` and
  `uq_product_review_device` intact
- Gate-6 preconditions at execution: `product_review` table plus
  `productId`/`store` columns present; duplicate check NOT APPLICABLE
  (non-unique lookups by contract); dry-run 4/4 PASS with exit 0
- Authorization ref: `D08-CAP2-20261008-product-review`; operator: `teddy-ferdian`
- Backup: fresh `pg_dump` custom-format full-database (pg_dump 17.11,
  1606100 bytes, 2026-10-08T04:33:42Z), Gate-7 verified PASS, restore
  UNTESTED (no drill performed, no capability overstated)
- Disposition counts after reconciliation: 197 rows; ATTESTED_PRESENT 179;
  EXCLUDED_UNSAFE 6; EXCLUDED_BY_DECISION 5; EXCLUDED_SUPERSEDED 4;
  CONTROLLED_APPLIED 2; CONTROLLED_APPLY_PENDING 1; BLOCKED_DECISION 0
- Remaining pending: `20260906000004-split-bill-hardening.js` (B1 still refused by exactly this one)

## Re-approval

The file-level `approvedBy`/`approvedAt` (`teddy-ferdian` /
2026-10-05T16:57:23Z) are carried over unchanged, so the reconciled bytes
hash to exactly the post-CAS SHA above (validator: `ok:true approved:true`).
Re-approval of the new SHA is recorded by the reconciling commit message +
PR review. This re-approval covers manifest accuracy only.

## Test consequences (mechanical, reviewed in the same PR)

- `migration-dispositions`: locked counts move PENDING 2 → 1, APPLIED 1 → 2
- `migration-preflight` (×2) and `production-schema-verifier`: pending-count
  assertions move `(2)` → `(1)`; refusal behavior unchanged
- `staging-rehearsal` divergence helper (introduced by the CAP #1
  reconciliation) already tolerates verified controlled progression
  generically — no change needed; every other difference still fails closed
