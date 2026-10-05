# E2 Role Migration Down Safety

This is a durable engineering/release record for
`20260613000003-insert-default-roles` (BE-local item
`E2-ROLE-MIGRATION-DOWN-SAFETY`). It is **not** a business decision and adds
no `DR-xx` entry. The BA decision register (`POS-MASTER-BUSINESS-ANALYSIS.md`
§35, `docs/product/OPEN-BUSINESS-QUESTIONS.md`) is unchanged.

- Recorded in repository: 2026-10-05
- Decision class: engineering / release safety
- Migration disposition: unchanged (E2 candidate; not a manifest row)
- Production manifest approval: **not granted** (unchanged)
- E2 execution: **not authorized** by this record

## 1. Decision

`20260613000003-insert-default-roles` is **forward-only** in deployed
environments. Its `down()` is an intentional, commented no-op, following the existing
no-op `down()` precedent below.

## 2. Reason (evidence)

| # | Evidence | Source |
|---|---|---|
| 1 | `up()` inserts a default role only when no row with that `roleType` exists, so it may insert all, some or none of the four roles | `db/migrations/20260613000003-insert-default-roles.js` (`up`, roleType guard) |
| 2 | `up()` keeps no record of the rows it inserted: no stored ids, no `RETURNING`, no marker. `createdAt` is the run time and is not an identity | same file |
| 3 | The former `down()` was `bulkDelete('role', { roleType: ['super_admin','admin','kasir','user'] })`, a physical DELETE by roleType that cannot tell migration-created rows from pre-existing or tenant-created ones | git history of the same file |
| 4 | Production `user.roleId` → `role(id)` is `ON DELETE CASCADE` (`user_roleId_fkey`), so deleting a role deletes its users. From `user`: `authorization_context_session` cascades, 9 FKs SET NULL, and 16 FKs are NO ACTION, which makes a delete fail when they hold references | `docs/superpowers/evidence/phase27-6-raw-capture-2026-10-05T13-09-47Z.json`; `scripts/dev-schema.sql` (`user_roleId_fkey`) |
| 5 | In production, all four existing roles predate this migration (three system roles and the tenant-created "Finance" role of type `user`), so the former `down()` would have deleted only rows it never created | Phase 27.6 evidence |
| 6 | The former `down()` bypassed every application safeguard on role deletion: super_admin-only route, single id, `isSystem` → 403, detaching `user.roleId` first, and a paranoid soft delete | `api/routes/role.js`, `api/controller/role.js` (`deleteRoleById`), `db/models/role.js` |
| 7 | Release flow is forward-only. `npm run migrate` runs only `db:migrate`, there is no undo path in npm scripts, CI or the runbook, and deployed recovery is backup restore | `scripts/run-migrations.js`, `RELEASING.md` ("Run migrations", "Restore") |
| 8 | Precedent: eight enum migrations already have a no-op `down()`, six of them with an explanatory comment (e.g. `20260608000000-add-kasir-role-type.js`), and `20261003000003-add-runtime-only-columns-f03.js` documents forward migration as the safe direction | `db/migrations/` |

Risk classification of the former `down()` in deployed environments:
**CATASTROPHIC / MUST NOT BE INVOKED**. Its outcome depends on the data: it
either deletes unrelated roles and their users, or it fails part-way through
a rollback.

Rejected alternatives:

- **Delete only rows created by `up()`:** impossible without a persisted
  identity. `createdBy IS NULL`, `isSystem` and role names all match
  pre-existing system roles as well.
- **Operational rule alone:** cannot be enforced, because anyone with
  credentials can run `sequelize-cli db:migrate:undo`.

## 3. Scope

- Applies to this migration only, and to deployed environments.
- Does **not** authorize E2 execution.
- Does **not** approve D-06.
- Does **not** resolve DR-22 (kasir provisioning remains DEFERRED).
- Does **not** change the migration's disposition or any manifest.
- Does **not** make `sequelize-cli db:migrate:undo` a supported production
  rollback mechanism.

## 4. Operational Rule

> Do not invoke `sequelize-cli db:migrate:undo` for this migration in
> deployed environments.

Production recovery remains restore-based (`RELEASING.md`, "Restore").

## 5. Implementation

- `db/migrations/20260613000003-insert-default-roles.js`: `down()` is now a
  comment-only no-op. `up()` is byte-identical to the previous version
  (createdBy contract from PR #162 retained).
- `__tests__/staging-rehearsal.test.js` (E2 data-migration idempotency block):
  - `down()` is non-destructive. Five roles, including a tenant-created
    `user` role, plus two users referencing roles through a
    production-shaped `ON DELETE CASCADE` FK: after `down()` the roles and
    users are unchanged, and no `queryInterface` or `sequelize.query` call
    is issued.
  - `down()` then `up()`: the state is unchanged, the `roleType` guard
    inserts nothing, and there are no duplicates.
  - Static guard: `down()` contains no executable statement and no
    destructive token.

## 6. Verification (2026-10-05, local; no production access)

| Check | Result |
|---|---|
| RED, against the previous destructive `down()` | the 3 new tests failed: calls issued and rows deleted; role table emptied; `bulkDelete` present |
| Targeted (`default-roles` / menu tests) | 8/8 passed |
| Focused suites (staging-rehearsal, migration-dispositions, migration-preflight, production-schema-verifier) | 112/112 passed; full rehearsal still `rehearsal-pass-blocked` |
| `npm test` | exit 0 — 231/231 suites, 2706/2706 tests |
| ESLint (changed JS files) | clean |
| Migration-chain validator (disposable local DB) | PASS — 236/236 ledger, 16 executed, 8/8 invariants; this migration is baseline-stamped and was not executed |
