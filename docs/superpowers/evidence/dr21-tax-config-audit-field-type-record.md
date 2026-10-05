# DR-21 Tax-Config Audit-Field Type — Decision Linkage & Technical Evidence Record

This is a durable repository record of the **already-recorded** DR-21
decision. The authority is the BA decision register: `POS-MASTER-BUSINESS-ANALYSIS.md`
§35 (register row DR-21) and §35.8 (decision record), mirrored in
`docs/product/OPEN-BUSINESS-QUESTIONS.md`. This file does not make, allocate or
amend that decision. It keeps the supporting technical evidence next to the
migration manifest, and it does not authorize any production migration.

- Decision reference: `DR-21` (disposition `decisionRef`: `DR-21 tax_config audit-field type (keep INTEGER)`)
- Decision: TAX-CONFIG-KEEP-INTEGER — DECIDED 2026-10-05 (BA §35.8; owner:
  STAKEHOLDER — product-owner written confirmation)
- Recorded in repository: 2026-10-05
- Production manifest approval: **not granted** (`approvedBy` / `approvedAt`
  remain `null` in `db/migration-dispositions/production.json`)
- Staging manifest: unchanged (the rehearsal keeps this row `BLOCKED_DECISION`)
- W-02 / G-02: not passed by this record

## 1. Decision Linkage

| Item | Value |
|---|---|
| Excluded historical migration | `20260616000002-fix-tax-config-audit-fields-type.js` → `EXCLUDED_BY_DECISION` (DR-21) |
| Authoritative decision | BA `POS-MASTER-BUSINESS-ANALYSIS.md` §35.8 (DR-21) |
| Prior evidence (pre-decision observation) | `docs/superpowers/evidence/w02r3r-report-2026-10-02T12-09-42Z.md` §5 "D-06 (tax_config audit-field type)"; `docs/superpowers/evidence/w02r3r-matrix-v2-reconstructed-2026-10-02T12-09-42Z.json` (E6) |
| Former manifest label | `D-06 tax_config audit-field type`. This was a BE-local label, not a BA alias (in the BA, `D-06` is a former alias of DR-11), so DR-21 replaces it. |

Pre-decision production observation (W-02R.3R, read-only, 2026-10-02):
`tax_config.createdBy` and `tax_config.modifiedBy` are `integer` (int4),
nullable, no default. The migration was not executed in production.

## 2. Decision Contract

- `tax_config.createdBy` and `tax_config.modifiedBy` remain `INTEGER`.
- Both hold the numeric `User.id` of the actor who created or last modified
  the row.
- Migration `20260616000002-fix-tax-config-audit-fields-type` is excluded
  from production and must never be executed there. The file stays in the
  repository and in the manifest; it is never deleted from the chain.

## 3. Technical Evidence

| # | Evidence | Source |
|---|---|---|
| 1 | Production columns are int4 / INTEGER | W-02R.3R report §5 (information_schema) |
| 2 | Model declares both fields `DataTypes.INTEGER` | `db/models/taxConfig.js` |
| 3 | Runtime writers set them from `req.user?.id` (`create`, `update`, and the spreadsheet `importData` bulk create); the default-tax seeders leave them `null` | `api/controller/taxConfig.js`, `db/seeders/20260616000001-default-tax-configs.js` |
| 4 | The original create migration declares INTEGER | `db/migrations/20260601000003-create-tax-config.js` |
| 5 | The VARCHAR change was introduced together with a STRING model; the writers already stored `req.user.id` | commit `a162642` (2026-06-16) |
| 6 | The model was reverted to INTEGER with no reversing migration, so the VARCHAR intent was abandoned | commit `8a47ac7` (2026-06-23) |
| 7 | The dev schema snapshot used to build test databases is `integer` | `scripts/dev-schema.sql` (`tax_config`) |
| 8 | INTEGER `createdBy` is the repository convention | `db/models/*.js` (large majority INTEGER) |

## 4. Migration Behavior (why exclusion, not "no-op")

- `up`: `ALTER COLUMN "createdBy"`/`"modifiedBy"` `TYPE VARCHAR(255) USING ...::TEXT`.
  It has no guard, so it would change the live production columns. Replay
  classification in the evidence is `APPLIES_MISSING_ONLY`, which means it is
  **not** a safe no-op.
- If applied, the database would be VARCHAR while the model stays INTEGER:
  string serialization of actor ids, and casts needed against `user.id`.
- `down`: `TYPE INTEGER USING NULL` erases every audit-actor value in both
  columns.
- The exclusion therefore reflects the desired contract (INTEGER), not a claim
  that replay is harmless.

## 5. Disposition Lifecycle

| Layer | State |
|---|---|
| Decision | DECIDED (DR-21, 2026-10-05) |
| Production schema / model | Already INTEGER; no schema change required |
| Production manifest row | `EXCLUDED_BY_DECISION`, `decisionRef` DR-21 (this change) |
| Manifest approval | Not granted; separate PR review (`RELEASING.md`) |
| Ledger stamp | Not done; separately authorized, SHA-pinned (`scripts/apply-migration-dispositions.js`) |

Fresh read-only production evidence must be captured before approval.

## 6. Test Expectations

- `__tests__/migration-dispositions.test.js`: the repository manifest holds
  `EXCLUDED_BY_DECISION` 5 and no `BLOCKED_DECISION`. This row's `decisionRef`
  starts with `DR-21`, and its evidence no longer claims a safe no-op.
- `__tests__/migration-preflight.test.js` and
  `__tests__/production-schema-verifier.test.js`: BLOCKED gate behaviour is
  exercised with synthetic `BLOCKED_DECISION` fixtures, independent of this
  manifest's current state.
- Accounting: 236 repository migrations = 197 manifest rows + 26 ledger rows +
  13 E2.
