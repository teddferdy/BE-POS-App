# D-08 B1 Resume Contract (B1-D05)

This is an engineering and release record for the only sanctioned way to
finish B1 after the 2026-10-08 partial run. It is **not** a business decision
and adds no `DR-xx` entry. It does not authorize execution.

- Recorded in repository: 2026-10-08
- Decision class: engineering / release safety (D-08 migration governance)
- Base contract: `docs/superpowers/evidence/d08-e2-batch-contract-record.md`
  (Option C). The frozen B1 list in `scripts/migration-batches.js` is
  **unchanged**.
- D-05 semantics: `docs/superpowers/evidence/d05-member-identity-contract.md`
  is **unchanged**. The D-05 migration source is **unchanged**.
- Production manifest: **unchanged**. `SequelizeMeta`: **unchanged** by this
  record.
- Resume execution: **not authorized** by this record.

## 1. Incident state the resume is pinned to

On 2026-10-08 the production B1 run behaved as follows:

- Pre-B1 SequelizeMeta was 223. That figure is derived: 26 historical rows
  plus 197 manifest-stamped rows, which also equals 235 − 12.
- B1 #1–#12 executed and were recorded normally.
- B1 #13 D-05 (`20261012000001-d05-member-identity-uniqueness.js`) aborted in
  its own preflight P1: `unparseable active phone values (count=4)`. The
  abort was fail-closed: one transaction, no DDL, no phone rewrite.
- Post-incident SequelizeMeta was 235: B1 12/13, D-05 not recorded, B2 0/3,
  B3 0/1. This was confirmed by a read-only capture on 2026-10-08
  (`transaction_read_only = on`).

The runner behaved correctly afterwards:

- `--batch B1` refuses, because members are already recorded.
- `--batch B2` refuses, because D-05 is pending and would run first.
- An unbatched run refuses, because batch members are pending.

## 2. Contract (`BATCH_RESUMES['B1-D05']`)

| Field | Value |
|---|---|
| Base batch | B1 (membership read from the frozen B1 list) |
| Expected recorded prefix | B1 #1–#12 (`recordedCount: 12`) |
| Resume members | `20261012000001-d05-member-identity-uniqueness.js` only |
| Ledger before / after | exactly 235 / exactly 236 |
| Postconditions | `D05_MEMBER_IDENTITY` |
| Open gate | `D05-AFFECTED-ROWS-DISPOSITIONED` |

Command: `npm run migrate -- --env production --resume B1-D05`. It cannot be
combined with `--batch`, and there is still no free-form `--to`.

## 3. Refusals (all before sequelize-cli starts)

The runner refuses in each of these cases:

- the D-08 preflight refuses (it stays authoritative);
- the environment is not disposition-governed;
- the resume id is unknown, or the definition is invalid (the members must
  be the exact suffix of B1, recorded count + members must equal 13, and
  ledgerAfter must equal ledgerBefore + members);
- any of B1 #1–#12 is unrecorded;
- D-05 is already recorded (for example, a manual stamp);
- the ledger is not exactly 235 rows, or has duplicate names;
- any pending migration other than D-05 would run first;
- a migration file is missing;
- the ledger state is unavailable;
- the gate is open.

## 4. Post-run verification and execution trail

After `db:migrate --to <D-05>` exits, the runner checks the following:

1. **Ledger:** SequelizeMeta is re-read read-only. It must have gained exactly
   D-05 and hold exactly 236 rows. Otherwise it reports
   `POST-RUN LEDGER MISMATCH` (exit 1).
2. **Postconditions:** these are read-only, from `pg_indexes` and
   `pg_constraint`, inside a `READ ONLY` transaction.
   - The four partial unique indexes `uq_member_store_name_ci`,
     `uq_member_global_name_ci`, `uq_member_phone_e164` and
     `uq_member_email_ci` must exist, with the contract expressions and
     predicates.
     Each must be `CREATE UNIQUE INDEX … ON public.member USING btree`.
   - None of the historical objects `uq_member_name`, `uq_member_phoneNumber`,
     `uq_member_email`, `uq_member_store_name` or `uq_member_global_name` may
     remain.
   - Backfill: the COUNT of active non-guest phones not matching E.164
     (`^\+[1-9][0-9]{6,14}$`) must be 0. Only the count is read; no member
     value is read.
   - Any failure, or an unreadable state, reports
     `POST-RUN POSTCONDITION FAILURE` (exit 1).
   - Definitions are matched by contract fragments, as in the D-05 migration
     test, not by whole strings. Local tests run on PostgreSQL 14 and
     production is 17, so an exact match could fail on formatting alone. The
     observed definitions are recorded verbatim instead (step 3).
   - If SequelizeMeta cannot be re-read after the runner exits, the runner
     reports `LEDGER UNVERIFIED` (exit 1, or the runner's own non-zero
     status). It does not claim success and does not proceed to the
     postconditions.
3. **Execution record:** every started run prints exactly one line,
   `[migrate] RESUME RECORD {json}`. It holds:
   - resume, batch, env, migrations, `to`;
   - start and finish time (ISO UTC);
   - runner status, ledger before and after, the added names;
   - the postcondition result, with `observed`: the four target index
     definitions verbatim, the constraint names, and the non-E.164 phone count;
   - the outcome
     (`RECORDED | RUNNER_FAILED | LEDGER_UNVERIFIED | LEDGER_MISMATCH | POSTCONDITION_FAILED`)
     and the exit code.

   Only `RECORDED` has exit code 0.

   The record contains no member data. Capture it into the execution
   evidence record.

## 5. Gate `D05-AFFECTED-ROWS-DISPOSITIONED`

The gate clears only through a reviewed change to
`scripts/migration-batches.js` that cites PII-free evidence of all of the
following:

1. A recorded business disposition for every affected member row:
   - **REAL:** the true phone, confirmed out of band, set through the audited
     application member-edit path.
   - **TEST:** a soft delete through the audited application member-delete
     path.
   - **UNRESOLVED** or **PENDING:** the gate stays open.
   - **REAL with the phone unavailable:** wait. Such a row stays pending and is
     never converted to TEST or soft-deleted by default.
2. A read-only verification for each corrected row: valid E.164 or
   `deletedAt` set, plus its audit event.
3. A fresh read-only recapture showing 0 unparseable active non-guest phones,
   0 canonical phone, name and email collisions, and SequelizeMeta still 235.

Clearing the gate does not authorize execution. Execution also needs its own
explicit approval, a fresh restore point and fresh read-only preconditions.

These paths are prohibited:

- loosening the parser;
- excluding rows from D-05;
- converting rows to `GUEST-*`;
- using `status = inactive` (it does not leave the D-05 population; the tests
  prove this);
- guessed or padded phones;
- manual stamping;
- re-sequencing D-05;
- a blind `--batch B1`;
- touching AFFECTED-04's linked orders (they stay PENDING and protected under
  their own governance).

## 6. Evidence (tests)

- `__tests__/migration-batch-resume.test.js` (pure) covers:
  - the contract;
  - every refusal, using the real-repository incident ledger (235 rows);
  - `--batch B1` and `--batch B2` still refused;
  - the runner happy path (235 → 236, postconditions, record);
  - runner failure, ledger mismatch, row-count mismatch, ledger re-read
    failure, postcondition failure (indexes, table/method, non-E.164 phones),
    reader error;
  - the default reader routing (D05_MEMBER_IDENTITY → the read-only member
    reader; unknown id refused);
  - argument rules;
  - read-only and no-ledger-write static checks.
- `__tests__/d05-member-identity-migration.test.js` (disposable local
  PostgreSQL, synthetic values) covers:
  - the postcondition checker on real `pg_indexes` output, before and after
    the migration;
  - a non-canonical active non-guest phone (a guest value is ignored);
  - a surviving historical constraint;
  - the incident shape (4/5/8/8-digit values) aborting with count=4;
  - `status = inactive` not unblocking;
  - soft delete (TEST) and a valid E.164 correction (REAL) unblocking, with
    soft-deleted rows retained.

## 7. Status at recording

| Item | Status |
|---|---|
| B1 | 12/13 — D-05 NOT RECORDED / BLOCKED |
| B1-D05 resume | IMPLEMENTED, GATE OPEN, NOT APPROVED, NOT EXECUTED |
| AFFECTED-01…04 | PENDING (no business disposition recorded) |
| AFFECTED-04 linked orders | PENDING, protected |
| B2 / B3 | 0/3 / 0/1 — B2 blocked until B1 is complete |
