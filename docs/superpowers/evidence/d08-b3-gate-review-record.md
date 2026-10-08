# D-08 B3 Gate Review Record

Formal gate-review evidence for the `P1-CANONICAL-WRITES-VERIFIED`
governance gate on batch B3 (`scripts/migration-batches.js`,
`E2_BATCHES.B3`).

This record is **evidence and review material only**. It does not execute
M3, does not stamp `SequelizeMeta`, does not create the CHECK constraint,
and does not authorize migration execution. Clearing the runner gate makes
B3 governance-eligible only; execution still needs its own explicit
authorization plus, per the D-08 record and RELEASING.md, an execution-time
restore point and fresh read-only preconditions.

- Recorded in repository: 2026-10-08 (this file, reviewed via PR)
- Decision class: governance / gate review (D-08 migration governance)
- Base contracts (unchanged): `d05-member-identity-contract.md`,
  `d08-e2-batch-contract-record.md` (B3 = M3 only; M3 renamed 0003 → 0005,
  pure rename; M6 VALIDATE deferred separately)
- B3 migration source:
  `db/migrations/20261013000005-p1-canonical-payment-check.js` (unchanged)
- Production manifest: unchanged. `SequelizeMeta`: unchanged by this record.

## 1. Gate definition (authoritative)

`P1-CANONICAL-WRITES-VERIFIED`: M3 refuses non-canonical `typePayment`
writes, so it may run only after **P1 code is live in production and
canonical payment writes are verified** (`scripts/migration-batches.js`
B3 reason; `d08-e2-batch-contract-record.md` B3 row; RELEASING.md E2 step).

## 2. Runtime evidence (production, read-only verified 2026-10-08)

| Item | Value |
|---|---|
| Deployed candidate | `f80ef8e` (canonical-safe build: `api/service/canonicalPayment.js`, normalize-or-422 on every reachable writer) |
| Previous production build | `a5deb07` (writes non-canonical aliases such as `cash`; superseded) |
| CASH sale | order 26 / ORD86570436HN2F → transaction 17, `typePayment` = CASH, 555000, register 3, exactly one row |
| E-WALLET sale | order 27 / ORD86689442R304 → transaction 18, `typePayment` = E_WALLET, 555000, register 3, exactly one row |
| Canonical set observed | exactly {CASH × 1, E_WALLET × 1}; zero unexpected values |
| Register #3 | opening 200000, cash sales 555000, e-wallet 555000 (excluded from drawer), expenses 0, expected cash 755000 — reconciles; left OPEN |
| Side effects | 2 orders + 2 items + 2 stock moves + audit 79 → 82 (+3, reconciled); members/users/roles untouched |
| Ledger at verification | 239 (B1 13/13 + D-05 + B2 3/3); M3 unrecorded; M3 CHECK absent |
| Rejected probes | untouched by live testing (covered by CANON-03 automated test: unknown method → 422, zero persistence) |

All persisted values were read from the `transaction.typePayment` column,
never inferred from UI labels.

## 3. Write-path audit (repository, read-only)

Every reachable `transaction.typePayment` writer normalizes-or-refuses via
the shared `normalizePaymentMethod` boundary (order settlement/create,
void refund with re-normalization at read, sales-return refund, split
payment); no UPDATE/UPSERT/bulk/raw-SQL writers to the column exist. The
single raw write (`order.js` `createCustomerOrder`, `paymentMethod ||
'cash'`) is unreachable dead code (`deductStock=false` hardcoded) — a
maintenance hazard M3 itself backstops, not a live violation. FE sends raw
aliases by design; the server boundary is the enforcement point, so no
client (including the unauthenticated QR path, which writes order intent
only) can bypass it.

## 4. Automated evidence (disposable databases, never production)

154 P1 tests green (CANON/REG/SPLIT/REFUND/ATTR/RACE runtime behaviors,
ATTR-SCHEMA M1/M2/M3-schema/M5/down/idempotency/orphan-fail-closed,
SNAPSHOT/Z/CLOSE-RACE/X close semantics, P0 money invariants), plus the
D-05/governance suites (185 total this arc). The gate-clearance change in
this PR updates the three batch tests that encoded the open B3 gate,
keeping the unknown-gate refusal coverage intact.

## 5. Coverage statement (honest)

Live-observed methods: CASH, E_WALLET (the only two configured production
`tender` values; both mapped and verified). CARD / BANK_TRANSFER / POINTS /
OTHER were not exercised live — no production configuration exists to
exercise them, and manufacturing coverage was refused. They are covered by
the automated suites above and remain NON-BLOCKING under the gate contract,
which requires live P1 behavior + verified writes (both present), not an
exhaustive method matrix.

## 6. What this gate review does and does not do

- DOES: record the evidence above; clear `P1-CANONICAL-WRITES-VERIFIED`
  on B3 so the batch becomes governance-eligible.
- DOES NOT: authorize M3 execution (still NO); execute or simulate any
  migration; touch `SequelizeMeta`, manifests, the M3 source, production
  data, or schema; fix the known dashboard display bugs (E_WALLET shown as
  "Lainnya", camelCase alias casing, open-register display) — those belong
  to a separate implementation PR after evidence closeout.

## 7. Reviewer decision required

By merging, the reviewer explicitly approves: (a) the runtime evidence in
§2 as satisfying both gate conjuncts, (b) the §5 coverage statement, (c)
that M3 execution remains unauthorized pending its own approval with an
execution-time restore point and fresh read-only preconditions.
