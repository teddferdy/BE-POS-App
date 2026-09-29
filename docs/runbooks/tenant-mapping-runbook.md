# Tenant Mapping Runbook (T-02)

Contract companion to `scripts/tenant-mapping-artifact.schema.json`, enforced by
`scripts/tenant-mapping-artifact.js` on top of the frozen legacy preflight
(`scripts/tenant-backfill-preflight.js`, T-01 D7 enforcement intact).

> **Scope.** This runbook governs the *mapping artifact contract*: how a
> store/tenant mapping is prepared, approved, validated, and evidenced. It
> defines **no production execution path** — there is intentionally no
> production apply tooling, no production CLI, and no production dry-run flag
> in this repository. Population execution requires separate approval,
> a staging environment, and tooling that does not exist yet (see §15).

## 1. Purpose and scope

- Define the single approved shape of a tenant/store mapping artifact:
  `{ rows, meta }`.
- Pin ownership semantics (preparer, reviewer-as-approver), D7 approval
  integrity, evidence, abort criteria, and recovery selection.
- Separate the strict approved-artifact boundary from the legacy pre-flight
  input boundary (`scripts/tenant-backfill-preflight.js` accepts a bare row
  array or `{ rows }`; that compatibility is frozen and is **not** an approved
  artifact).

## 2. Artifact structure

Top level (both keys required):

```json
{
  "rows": [ { "storeId": 1, "disposition": "MAP", "tenantId": 10, "source": "ticket-123/sheet-tab", "reviewer": "reviewer@example.test", "approval": "approved", "effectiveAt": "2026-09-25T00:00:00.000Z" } ],
  "meta": { "preparer": "preparer@example.test", "reviewer": "reviewer@example.test", "approval": "approved", "preparedAt": "2026-09-25T00:00:00.000Z", "reviewedAt": "2026-09-25T01:00:00.000Z", "evidenceRef": "review-ticket-123" }
}
```

- `rows`: non-empty array, input order preserved, `storeId` unique
  (`DUPLICATE_STORE_ID` otherwise). `tenantId` required when `disposition`
  is `MAP`. Dispositions: `MAP`, `QUARANTINE`, `GLOBAL`, `RETIRE` only.
- `meta`: required. `preparer`, `reviewer`, `approval: "approved"`,
  `preparedAt`/`reviewedAt` (ISO-8601 UTC, strictly calendar-validated),
  `evidenceRef` (opaque non-empty reference to the retained evidence bundle;
  no filesystem or deployment paths are defined by this contract).
- **Unknown fields are rejected** at artifact, row, and meta level
  (`UNKNOWN_ARTIFACT_FIELD`, `UNKNOWN_ROW_FIELD`, `UNKNOWN_META_FIELD`).
  There is no `approver` field anywhere: it is rejected as unknown.
- Row order is preserved; every error carries a stable `rowIndex` where it
  concerns a row; error ordering is deterministic (code, field, message).

## 3. Ownership model

- **preparer**: identity of the person who prepared the artifact. Required.
  Never inferred — a present `source` label does not satisfy `preparer`.
- **reviewer**: identity that reviewed and approved the artifact and its rows.
  **reviewer IS the approver.** No separate approver identity exists.
- `approval: "approved"` is the approval act of the reviewer identity, at
  both row and artifact level.
- **preparer and reviewer are independent identities**: the contract allows
  `preparer != reviewer` and does not force them apart. No repository
  contract requires distinct preparation/review identities; D7 constrains
  only source vs reviewer.
- **Binding**: `meta.reviewer` must equal every row reviewer
  (single-approver artifact; `META_REVIEWER_MISMATCH` otherwise).

## 4. D7 approval rule

`normalized source !== normalized reviewer`, enforced in
`validateMappingRow` (`SELF_APPROVAL` on field `reviewer`):

- Comparison uses trimmed normalized values, case-insensitive.
- Identical, case-variant, and whitespace-variant pairs are rejected.
- No batch exemption exists and none is defined by this contract.
  `SELF_APPROVAL` is mandatory and has no override.

## 5. Artifact preparation

1. Enumerate the target store population from the source of truth (no
   invented counts; every row traces to an observed store).
2. Assign exactly one disposition per store; `MAP` rows carry the approved
   `tenantId`.
3. Fill `source` (origin label), `reviewer` (approver identity),
   `approval: "approved"`, `effectiveAt` per row.
4. Fill `meta`: `preparer`, `reviewer` (= every row reviewer),
   `approval: "approved"`, `preparedAt`/`reviewedAt` (ISO-8601 UTC),
   `evidenceRef` pointing at the retained review record.
5. Serialize deterministically (stable key order, UTF-8 JSON).
6. Never add extra keys: strict validation rejects them.

## 6. Preflight

Run `validateMappingArtifact(artifact, storeSnapshots)`:

- Shape/meta/ownership/timestamp/unknown-field checks run first.
- Row validation delegates to the frozen `validateStoreMapping`, inheriting
  T-01 D7 enforcement, the full error vocabulary, duplicate detection,
  persisted-store comparison, deterministic ordering, and summary counters.
- Result `{ valid, meta, summary, errors }`. `valid` is true only when every
  strict check and the full preflight pass. `meta` echoes normalized
  ownership metadata (null when meta is invalid).

## 7. Validation

- **Preflight abort** (any of): `INVALID_ARTIFACT_SHAPE`, `MISSING_META`,
  `MISSING_PREPARER`, `MISSING_REVIEWER` (`meta.*` or row level),
  `MISSING_APPROVAL`, `UNAPPROVED`, `MISSING_PREPARED_AT`,
  `MISSING_REVIEWED_AT`, `INVALID_PREPARED_AT`, `INVALID_REVIEWED_AT`,
  `MISSING_EVIDENCE_REF`, `UNKNOWN_*`, `META_REVIEWER_MISMATCH`,
  `SELF_APPROVAL`, any legacy row/mapping error.
- Missing ownership metadata **invalidates**; it never degrades to a
  warning (warnings are a silent-fallback vector, SI-13).
- Known limitation: preflight does not check tenant status
  (active/deleted); deleted or inactive tenants abort at apply time
  (`TENANT_NOT_APPROVED`). A preflight tenant-status check is future work,
  not a silent pass.

## 8. Approval / sign-off

Human sign-off is required and is recorded in `meta` + the retained
evidence bundle (`evidenceRef`):

- Reviewer confirms every row, the disposition set, and the population
  coverage (expected vs actual store census).
- All SUPER-01 classifications (global/store-bound `super_admin`) are
  resolved by human review; nothing auto-converts.
- Any `unresolved > 0`, any population delta, any `GLOBAL` disposition, and
  any reconciliation mismatch require explicit sign-off before proceeding.
- Sign-off never overrides `SELF_APPROVAL` or a failed safety guard.

## 9. Apply boundary

- The only apply harnesses in this repository are **test-only**
  (`applyTenantFoundationMigration`, `applyLegacyUserMigration`): they
  refuse production configuration, run preflight before any write, are
  idempotent and resumable, and emit evidence.
- **Apply gate**: preflight must be `valid`; guards must pass; sign-off must
  be recorded. A failed preflight writes nothing.
- There is no production apply path. Any future one must re-establish these
  gates; this runbook does not authorize inventing one.

## 10. Reconciliation checklist

Deterministic checks (supported today via preflight/apply evidence):

- [ ] `valid`, per-disposition counts (`mapped/quarantined/global/retired`),
      `applied/skipped`, `unresolved == 0`, `errors` empty.
- [ ] Every applied change has a before-image in `changes[]`.
- [ ] No `DUPLICATE_STORE_ID`, no `STORE_TENANT_MISMATCH`, no
      cross-tenant violation.

Future checks (require tooling + human sign-off, §15):

- [ ] Expected store population vs actual (missing/unexpected rows).
- [ ] Expected membership/assignment counts post-apply.
- [ ] Post-apply tenant-consistency re-check.
- [ ] Population deltas reviewed and signed off.

## 11. Abort criteria

| Condition | Preflight abort | Apply gate | Reconciliation / human |
|---|---|---|---|
| `SELF_APPROVAL` | yes, no override | never reached | n/a |
| Unresolved / invalid / bad disposition / duplicate / mismatch / not-found | yes (existing codes) | never reached | fix artifact, re-run |
| Missing ownership metadata or evidence | yes | gated | no warn-and-continue |
| Invalid timestamps | yes | gated | fix, re-run |
| Tenant deleted/inactive | no (known gap) | `TENANT_NOT_APPROVED` abort, evidence retained | human review; future preflight check |
| Safety guard failure | refusal before any work | same | fix environment |
| Population delta / reconciliation mismatch | no tooling | n/a | human abort, forward-reconcile |
| Missing evidence for retry | — | error carries `evidence`/`preflight` | require evidence before retry |

No numerical thresholds are defined; any nonzero `unresolved` aborts.

## 12. Recovery procedure

- **PRIMARY — forward reconciliation.** Correct the artifact, re-validate,
  re-run. Idempotency guarantees reruns only fill gaps, never rewrite.
- **CURRENT ROLLBACK — evidence-backed only.** The test harness supports
  `rollbackTenantFoundationMigration({ evidence })`, restoring each
  `changes[].before` and reporting `{ reverted }`. Only changes present in
  the evidence bundle are reversible in code.
- **EMERGENCY — snapshot recovery is future capability, not currently
  available.** No snapshot mechanism exists for mapping runs; do not assume
  one. Anything outside `changes[]` requires data reconciliation plus human
  sign-off.
- A failed run is resumed by re-running with the corrected artifact after
  reviewing the retained evidence; never retry blind.

## 13. Evidence retention

Retain, versioned, alongside the artifact:

- The exact artifact JSON that was validated (rows + meta).
- The preflight result (`valid`, normalized `meta`, full `errors`).
- The apply evidence (`applied/skipped/*`, `errors[]`, `changes[]`).
- The `evidenceRef` target (review record / approval bundle).
- Rollback evidence (`{ reverted }`) when rollback runs.

Evidence is deterministic JSON. Retention location is operational and
outside this contract; inventing production paths is out of scope.

## 14. Safety boundaries

- No database writes during validation (`validateMappingArtifact` takes
  plain store snapshots; no DB handle exists in its signature).
- No JWT claims as authority (static source assertions cover new files).
- No production configuration accepted by any harness (NODE_ENV, URL-host,
  and connected-database gates).
- No destructive operation without explicit confirmation (`destructive-guard`
  default-deny pattern for any future destructive tooling).
- No silent fallback: unknown fields rejected, missing ownership
  invalidates, unresolved aborts.

## 15. Explicit future decisions (out of scope for T-02)

- AUD-3 migration audit-row storage (the `auditLog` JSONB `metadata` +
  `tenantId` slot is the natural host, undecided).
- Migration-state tracking table and rollout flags (each REQUIRES MIGRATION;
  not designed here).
- Staging environment (required before any Gate-C execution).
- Production apply tooling and production dry-run (intentionally absent).
- Batch evidence semantics (no approved contract; none invented).
- Preflight tenant-status check (known gap, §7).
- Expected-population reconciliation tooling (§10 future checks).
