# D-08 B1-D05 Execution Record

Factual record of the authorized production execution of the B1-D05 resume
(D-05 only). This document records what happened; it grants nothing and
changes no governance state. B2 and all other migrations remain unauthorized
and unexecuted.

- Executed: 2026-10-08T16:55:15Z → 2026-10-08T16:55:19Z (UTC)
- Environment: production `neondb` (Neon branch `production`), PostgreSQL 17.11
- Repository: HEAD `f916aeb` content via `fix/d05-gate-review` @ `cd7d9eb`
  (governed files byte-identical to origin/master `45c423e` at execution)
- Command (only command run): `npm run migrate -- --env production --resume B1-D05`
- Exit code: 0

## 1. Authorization (scope as granted, not broadened)

Owner statement on record: execution of B1-D05 against production neondb,
ledger 235 → 236, via the governed resume path, with restore point
`neondb-pre-d05-20261008.dump` (SHA-256
`b915f03920f733f7864dfef9cdec9efcbb80b26eb4b1eb5ebbad733d2b9e1373`,
UNTESTED), and no other migration or unrelated change. No broader
authorization exists or is inferred.

## 2. Final preconditions (fresh, read-only, immediately pre-run)

Ledger 235 with B1 #1–12 individually confirmed + zero duplicates; D-05
absent; 0 `uq_member%` indexes; preflight population empty (0 active
non-guest members → 0 invalid, 0/0/0 collisions); ops zero (orders,
transactions, registers); audit 79; users 11; governed files byte-identical
to origin/master; app live; restore SHA re-verified exact. One self-caught
probe bug occurred (a B1-count query omitted one filename); re-ran per-name
and confirmed 12/12 present before proceeding. Reported, not hidden.

## 3. Runner result (verbatim machine record)

`[migrate] RESUME RECORD {"resume":"B1-D05","batch":"B1","env":"production",`
`"migrations":["20261012000001-d05-member-identity-uniqueness.js"],`
`"to":"20261012000001-d05-member-identity-uniqueness.js",`
`"startedAt":"2026-10-08T16:55:16.185Z","finishedAt":"2026-10-08T16:55:19.603Z",`
`"runnerStatus":0,"ledgerBefore":235,"ledgerAfter":236,`
`"added":["20261012000001-d05-member-identity-uniqueness.js"],`
`"postconditions":{"id":"D05_MEMBER_IDENTITY","ok":true,"failures":[],`
`"observed":{"indexDefs":{`
`"uq_member_store_name_ci":"CREATE UNIQUE INDEX uq_member_store_name_ci ON public.member USING btree (store, lower(TRIM(BOTH FROM name))) WHERE ((store IS NOT NULL) AND (\"deletedAt\" IS NULL))",`
`"uq_member_global_name_ci":"CREATE UNIQUE INDEX uq_member_global_name_ci ON public.member USING btree (lower(TRIM(BOTH FROM name))) WHERE ((store IS NULL) AND (\"deletedAt\" IS NULL))",`
`"uq_member_phone_e164":"CREATE UNIQUE INDEX uq_member_phone_e164 ON public.member USING btree (\"phoneNumber\") WHERE ((\"deletedAt\" IS NULL) AND ((\"phoneNumber\")::text !~~ 'GUEST-%'::text))",`
`"uq_member_email_ci":"CREATE UNIQUE INDEX uq_member_email_ci ON public.member USING btree (lower(TRIM(BOTH FROM email))) WHERE ((\"deletedAt\" IS NULL) AND (email IS NOT NULL))"}},`
`"constraintNames":["member_pkey"],"nonCanonicalActivePhones":0}},`
`"outcome":"RECORDED","exitCode":0}`

(Full verbatim JSON retained in session evidence; index definitions match
the D-05 contract fragments exactly.)

## 4. Independent post-run verification (read-only)

Ledger 236, D-05 recorded exactly once, zero P1 rows, zero duplicates;
exactly the four `uq_member%` indexes, zero historical objects; members
9 physical / 0 active (untouched, nothing qualified for backfill);
orders/transactions zero; audit still 79; app `/health` ok post-run.

## 5. Scope containment

Only D-05 applied. No B2/B3/E2 remainder, no P1 file, no manifest/runner/
preflight change, no deployment as part of this task.

## 6. Recovery status (unchanged by execution)

Restore point verified pre-run (artifact + SHA above, local-only);
RESTORE_CAPABILITY = UNTESTED (no drill performed, none claimed).
`down()` drops only the four indexes; canonical phones would stay canonical
— full restoration remains restore-point-based. No recovery was needed
(clean success).

## 7. Batch status after execution

B1 = COMPLETE (13/13). B2 = BLOCKED behind its own approval (not authorized,
not executed). No further migration is authorized by anything in this record.

## 8. Preserved limitations

Deployed app commit unpinned (liveness verified, not version); restore
artifact local-only; restore capability UNTESTED; independent verifier role
never formally filled (runner's mechanical checks acted as second check);
member `status` column still reads `active` on paranoid-deleted rows
(deletion state carried by `deletedAt`, per implementation).
