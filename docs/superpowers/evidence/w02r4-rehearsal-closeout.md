# W-02R.4 Staging Rehearsal — Evidence Closeout

This is a factual audit record. It does not authorize production migration and
does not pass W-02 or G-02.

## 1. Rehearsal Identity

- Repository: `BE-POS-App`
- W-02R.4 implementation merge: PR #148
- Merge commit: `7eed4f8ea3fc9c774f3eca6cac504f9c8d13f20f`
- Rehearsal target: staging only
- Rehearsal DB: `cashier_app_staging_rehearsal_w02r4run`
- PostgreSQL: 14.19 local Homebrew
- Rehearsal evidence:
  `docs/superpowers/evidence/w02r4-rehearsal-2026-10-02T09-16-19-421Z.json`
- Evidence SHA-256:
  `be208d1b94eb6316fb32d908fa255f1d679a3809fff99388ee8ecf40c4a10954`

## 2. Rehearsal Result

The W-02R.4 staging rehearsal completed successfully with the expected
blocked-decision end state.

- S0 baseline: PASS
- S1 synthetic drift: PASS
- S2 disposition stamping: PASS
- S3 controlled operations: PASS
- S4 E2 migrations: PASS
- S5 final verification: PASS with expected blocked status
- Final SequelizeMeta count: 235
- Duplicate migrations: 0
- Orphan migrations: 0
- Unaccounted migrations: 0

The rehearsal was staging-only and production was not contacted.

## 3. Migration Accounting

The rehearsal reconciled:

```text
235 total repository migrations
= 197 disposition rows
+ 26 existing ledger representation
+ 12 E2 runner candidates
```

Disposition rows:

```text
179 ATTESTED_PRESENT
 10 excluded
  3 controlled-applied
  5 blocked
= 197
```

Runner-recorded rows:

```text
26 + 12 = 38
```

## 4. Approval Provenance

The staging manifest used during rehearsal was temporarily populated with:

```text
approvedBy: teddy-ferdian
approvedAt: 2026-10-02T09:30:00Z
```

The resulting approved-manifest SHA-256 was:

```text
f8f2f2287e8c191188b0e83781b4714e33376f402b5cf485e8fb4ce9830ab450
```

The rehearsal harness required the exact manifest SHA and approval fields
before creating the rehearsal database.

After the rehearsal, `staging.json` was restored to its committed unapproved
state:

```text
approvedBy: null
approvedAt: null
```

The committed staging manifest remains unapproved.

Independent reconstruction: take `db/migration-dispositions/staging.json` at
commit `7eed4f8` (git blob `f29e9b7aae3bcc9ee07394c822d502919cd033d8`,
SHA-256 `9a96dede5880a50d4f2fa2b67563a29b43a2daf70e0a2599812e9a2a24fd022b`),
replace only lines 5–6 with `  "approvedBy": "teddy-ferdian",` and
`  "approvedAt": "2026-10-02T09:30:00Z",`, and hash the result. It yields
`f8f2f2287e8c191188b0e83781b4714e33376f402b5cf485e8fb4ce9830ab450`, the
`manifestSha256` recorded in the rehearsal evidence.

## 5. Approval Timestamp Limitation

The recorded approval timestamp:

```text
2026-10-02T09:30:00Z
```

is later than the actual rehearsal start:

```text
2026-10-02T09:16:19.421Z
```

The repository validator accepted this because its validation rule requires
only:

```text
approvedAt >= evidenceCapturedAt
```

The timestamp therefore passed repository validation.

However, the chronology does not establish that the approval occurred before
rehearsal execution.

The `approvedAt` value originated as an example timestamp supplied during the
interaction and was subsequently used as the authorized value. It is not an
observed or independently recorded approval time.

This is classified as:

```text
AUDIT_INCONSISTENCY
```

It MUST NOT be rewritten or represented as an observed approval event.

The purpose of this closeout record is to preserve the fact rather than
conceal or normalize the inconsistency.

## 6. Durable Evidence Limitation

The rehearsal JSON does not independently record:

- `approvedBy`;
- `approvedAt`.

The approved manifest SHA binds the rehearsal to the exact approved bytes used
during execution, but the approval values themselves are not present in the
durable JSON evidence.

This was classified during the read-only evidence audit as:

```text
CLOSEOUT-BLOCKING
```

The present closeout record preserves those values and their provenance as a
separate durable audit artifact.

## 7. Other Evidence Limitations

The following were classified as non-blocking for W-02R.4 closeout:

- DB host classification and `current_database()` result were enforced at
  runtime but not explicitly serialized into the evidence;
- goods-receipt idempotency index was not independently enumerated in the
  evidence;
- stock-transfer idempotency index was not independently enumerated in the
  evidence;
- H1 guard branch was derived from the successful result and final role counts
  rather than directly logged;
- cleanup was verified separately by a read-only database check rather than
  recorded inside the rehearsal JSON.

These limitations do not alter the recorded rehearsal result.

## 8. H1

Migration:

```text
20260613000003-insert-default-roles.js
```

successfully exited 0 because the rehearsal fixture already contained all four
role types.

The migration's `createdBy: 'system'` value is incompatible with the integer
`createdBy` column if the INSERT path is reached.

The rehearsal therefore proves only the existing-role guard path.

It does NOT prove success for:

- an empty role table;
- a partially populated role table.

H1 remains an outstanding production-gate issue.

No H1 code was changed during the rehearsal or closeout.

## 9. Blocked Decisions

The following remained blocked and were not executed:

D-05:

- `20260620000004`
- `20260913000001`

D-06:

- `20260616000002`

D-08 / DR-06:

- `20260618000004`
- `20260620000005`

No business decision was inferred from the rehearsal.

## 10. Cleanup

The disposable rehearsal database:

```text
cashier_app_staging_rehearsal_w02r4run
```

was removed.

A subsequent read-only database check found zero databases matching the
rehearsal pattern.

Pre-existing databases were not modified.

## 11. Production Boundary

Production was not contacted.

The staging harness is source-level isolated through:

- staging-only manifest selection;
- `STAGING_DB_*` connection path;
- production-manifest rejection;
- rehearsal database-name guard;
- local-host guard;
- staging migration environment.

## 12. Closeout Classification

The read-only evidence audit classified the evidence as:

```text
EVIDENCE REQUIRES HARDENING BEFORE CLOSEOUT
```

The required hardening for this closeout is documentation durability only:

1. preserve the existing rehearsal JSON;
2. add this closeout record;
3. commit both artifacts.

No rehearsal rerun is required.

Optional harness improvements are explicitly outside this closeout.

## 13. Gate Status

```text
W-02R.4 rehearsal: PASS
W-02: NOT PASSED
G-02: NOT PASSED
Production migration authorization: NOT GRANTED
Production boundary: NO CONTACT
```
