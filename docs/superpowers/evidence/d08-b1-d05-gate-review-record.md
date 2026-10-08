# D-08 B1-D05 Gate Review Record

Formal gate-review evidence for the `D05-AFFECTED-ROWS-DISPOSITIONED`
governance gate on the B1-D05 resume
(`scripts/migration-batches.js`, `BATCH_RESUMES['B1-D05']`).

This record is **evidence and review material only**. It does not execute
D-05, does not stamp `SequelizeMeta`, does not create indexes, and does not
authorize migration execution. Clearing the runner gate makes B1-D05
governance-eligible only; execution still needs its own explicit approval
plus, per the D-08 record and RELEASING.md, an execution-time restore point
and fresh read-only preconditions.

- Recorded in repository: 2026-10-08 (this file, reviewed via PR)
- Decision class: governance / gate review (D-08 migration governance)
- Base contracts (unchanged): `d05-member-identity-contract.md`,
  `d08-e2-batch-contract-record.md`, `d08-b1-d05-resume-record.md`
- D-05 migration source: unchanged. Production manifest: unchanged.
  `SequelizeMeta`: unchanged by this record.

## 1. Technical baseline (read-only verified 2026-10-08)

| Item | Value |
|---|---|
| Repository HEAD / origin/master | `f916aeb` (PR #174 merge) |
| `SequelizeMeta` (production) | 235, B1 12/13, D-05 NOT RECORDED |
| D-05 target indexes (`uq_member%`) | 0 (absent) |
| Migration files | 240, D-05 file present and unmodified |
| Worktree at recording | clean, no migration executed |

## 2. Affected-row dispositions (historical evidence)

The four rows that aborted the 2026-10-08 B1 run (D-05 preflight P1,
`unparseable active phone values (count=4)`) were owner-confirmed as
**TEST / setup data**:

| Row | Disposition | Basis (PII-free) |
|---|---|---|
| AFFECTED-01 | TEST | owner business confirmation; corroborating fixture pattern (short undialable phone, setup-week burst creation, zero activity) |
| AFFECTED-02 | TEST | owner business confirmation; same corroboration as -01 |
| AFFECTED-03 | TEST | owner business confirmation **plus** provenance self-identification (test-pattern name), fixture-pattern phone, seed-creator, zero activity |
| AFFECTED-04 | TEST | owner explicitly confirms the member **and** its two linked paid orders are dummy/setup transactions; orders immutable regardless |

No row was classified by technical inference alone: rows 01/02/04 rest on
explicit owner confirmation, row 03 additionally on explicit
self-identifying evidence. No true-phone (REAL) disposition exists for any
row; no phone value is recorded anywhere in this evidence.

## 3. Post-reset supersession (explicit rationale for the gate author)

After the dispositions above, an authorized full reset removed all four
rows physically (single transaction, 311 rows across 18 operational tables;
schema, `SequelizeMeta`, audit history, users/roles, and reference data
preserved; pre-reset evidence captured). Per-row app-path verification
(valid E.164 or `deletedAt` + audit event) therefore cannot be produced for
rows that no longer exist.

This record states the supersession explicitly instead of hiding it: the
gate's intent — no legitimate member data stands in D-05's way — is
satisfied more strongly than a soft-delete would (the rows are gone, not
merely hidden), and §4–§6 below re-prove the clean state on the live
database. The gate reviewer approves or rejects this rationale by merging
(or refusing) the gate-review PR. No approval is claimed in advance.

## 4. Live application-path proof (fresh fixtures, post-reset)

After the reset, nine synthetic members (`D05T` prefix) exercised the
audited paths against the live pre-D-05 schema: valid E.164 create,
national-form canonicalization, invalid-phone 400 with no row, canonical
duplicate 409, same-bucket name 409, cross-bucket coexistence rules,
case-insensitive email 409, NULL-email coexistence, soft-delete with
identity release and distinct recreated ID, physical retention with
`deletedAt`, no revival. All behaved per contract; rejected requests
created no rows.

## 5. Cleanup + final M08 (read-only verified 2026-10-08)

| Item | Value |
|---|---|
| D05T physical rows | 9 (ids 5–13), all retained |
| D05T active rows | 0 (all 9 soft-deleted via the audited app path) |
| D05T lifecycle audit | 9 creates + 9 deletes, 0 unexplained (audit 61 → 71 → 79) |
| Operational side effects | none (orders/payments/journals/stock/registers all 0; users 11, roles 5) |
| Invalid active non-guest phones | 0 |
| Canonical phone / name / email collisions | 0 / 0 / 0 |
| `SequelizeMeta` | 235, D-05 NOT RECORDED |

## 6. Automated evidence (disposable databases, never production)

Previously recorded green runs (reported as recorded, not rerun against
production): batch-resume + batches 79, D-05 migration 20,
identity/phone-lookup/name-scope 65, preflight 20 — 184 total. The
gate-clearance change in this PR updates the three resume tests that
encoded the open gate and adds an unknown-gate refusal test, keeping the
fail-closed mechanism covered.

## 7. What this gate review does and does not do

- DOES: record the evidence above; clear `D05-AFFECTED-ROWS-DISPOSITIONED`
  on `B1-D05` so the resume becomes governance-eligible.
- DOES NOT: authorize D-05 execution (still NO); execute or simulate any
  migration; touch `SequelizeMeta`, manifests, the D-05 migration source,
  production data, or schema.
- Live UI coverage gaps (guest create, cross-store pair, global/store
  matrix, case/whitespace duplicate, padded email) are covered by the
  automated suites above and are non-blocking under the gate contract,
  which requires disposition + verification + recapture, not a live matrix.

## 8. Reviewer decision required

By merging, the reviewer explicitly approves: (a) the §3 supersession
rationale, (b) the completeness of §§4–6 as gate evidence, (c) that D-05
execution remains unauthorized pending its own approval with an
execution-time restore point and fresh read-only preconditions.
