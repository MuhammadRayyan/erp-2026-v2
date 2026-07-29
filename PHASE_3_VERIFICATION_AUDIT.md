# Phase 3 Verification Audit

Audit date: July 29, 2026
Audit basis: repository code, Prisma models, committed migrations, PostgreSQL catalogs, clean-install and base-to-head upgrade databases, API and server use cases, unit tests, PostgreSQL integration tests, Playwright browser workflows, Docker configuration, Git history, and executable GitHub Actions evidence. `PROGRESS.md` and `CHANGELOG.md` are claims to verify, not evidence by themselves.

## Current conclusion

Phase 3 shared ERP foundations are complete. The transaction, authorization, tenant-scope, lifecycle, concurrency, setup, browser, migration-integrity, and tenant-access-audit gaps found by this independent audit were corrected through PRs #22–#25 and verified through clean executable gates.

PR #25 merged normally as `f13644c3d6248bf074647377b65910af8447ad9a` after its synchronized exact head passed the full gate. Phase 4 may begin with chart structure and account lifecycle. No accounting transaction workflow may be exposed until periods/locks, the balanced posting kernel, idempotency, reversals, and PostgreSQL integration tests exist.

## Verified foundations

- Better Auth uses PostgreSQL-backed revocable sessions.
- Tenant administration and business access remain separate authorization boundaries.
- Business access requires active tenant/business memberships and an active tenant subscription.
- Operational records use tenant/business-scoped queries and composite PostgreSQL foreign keys.
- Parties, catalog, imports, custom fields, files, numbering, exports, email outbox, and access history have PostgreSQL integration coverage.
- Private file objects remain outside the public web root and downloads are authenticated and non-cacheable.
- Catalog imports use persisted previews, explicit decisions, target-version checks, and locked commits.
- Numbering uses locked, idempotent, immutable, non-reusable allocation history.
- Controlled exports are permission-scoped, spreadsheet-safe, bounded, checksummed, and do not retain generated payloads.
- Email work is durable, concurrently claimed, retried with bounded backoff, correlated with current invitation state, and scrubbed after terminal outcomes.
- Production browser verification exercises real PostgreSQL, Mailpit, SMTP worker processing, private storage, and cookie-backed sessions.
- Clean migration replay, Prisma-supported drift, PostgreSQL-specific invariants, real base-to-head upgrades, and representative-data preservation are enforced in CI.
- Tenant access changes create append-only tenant-level history protected by PostgreSQL immutability and owner-only reads.
- Migration and runtime images build, the runtime image boots against PostgreSQL, readiness succeeds, and the protected outbox endpoint responds.

## Corrected during this audit

### Tenant access and invitations

- Protected `business.owner` invitation grants are rejected and rechecked during acceptance.
- Expired invitation/outbox states commit before `INVITATION_EXPIRED` is returned.
- Tenant administration services consistently enforce active ownership and `users.manage`.
- Invitation grants are bound to their invitation tenant through composite scope.
- Pending invitations normalize expiry before administration display.
- Claimed invitation messages recheck actionable state before SMTP delivery.
- Invitation creation is serialized by the tenant user-capacity lock.
- Acceptance and revocation lock the invitation row before lifecycle evaluation.
- Conditional bulk expiry creates exactly one expiry event under repeated/concurrent refreshes.

### Catalog lifecycle and imports

- Item edits and lifecycle transitions lock the item row.
- Reactivation locks and validates the referenced unit.
- Import row decisions cannot race final commit.
- Update rows reject targets changed after preview.

### Numbering

- Settings updates and allocations lock the same sequence row.
- Reset policy and start value become immutable after first allocation.
- Reused idempotency keys must match the original date and reference.
- Voids lock the allocation and create one transition/audit event.

### Delivery, setup, and deployment

- Changed email payloads cannot reuse an idempotency key.
- New password-reset requests cancel older queued resets.
- Module phase metadata matches the roadmap and is unit-tested.
- Host setup starts the email worker and documents outbox settings.
- PostgreSQL and Mailpit are loopback-bound.
- The worker waits for database-aware readiness.
- Sensitive business-profile changes create audit events.

### Browser integration

- Playwright runs one stateful Chromium workflow against the production build and clean PostgreSQL/Mailpit services.
- The scenario proves anonymous denial, sign-up, onboarding, party/catalog creation, private upload/download, invitation delivery/acceptance, owner access-history visibility, viewer read-only enforcement, password reset, session revocation, and reauthentication.
- Viewer authorization is checked through both missing write controls and a direct authenticated `403` write denial.
- Private downloads are byte-verified for owner and viewer contexts.
- Invitation/reset links remain on the configured origin and tokens are not logged.
- Failure evidence retains short-lived traces, screenshots, videos, and an HTML report.
- The browser gate found and verified the asynchronous `PartyCreateForm` element-lifetime fix.
- Stateful security workflows run once per clean job so legitimate rate limits do not hide primary failures.

### Migration integrity

- Supported live foreign keys and stable database names are represented in Prisma.
- Existing SQL names use Prisma mappings, avoiding duplicate simpler keys or unintended renames.
- The party trigram GIN/operator-class index is represented in Prisma.
- Clean CI requires migration-history status and an empty Prisma schema-to-database diff.
- The PostgreSQL catalog manifest verifies 27 critical composite foreign keys, 38 check constraints, three custom indexes, two trigger/function pairs, and `pg_trgm`.
- Pull requests create a second database from the exact base commit, seed representative user/owner/tenant/business/unit/party data, apply head migrations, then repeat status, diff, catalog, and preservation checks.

### Tenant access history

- Invitation creation, supersession, revocation, expiry, and acceptance create typed tenant events.
- Member activation/disablement, business grant/update/disablement, and administration-driven session revocation create typed events with meaningful before/after metadata.
- Access events are written inside the same transaction as their state changes.
- No-op requests create no history, while contradictory disable-plus-active-grant requests are rejected.
- PostgreSQL rejects every access-event update and delete.
- Optional business correlation is composite tenant-scoped.
- The metadata guard rejects password/secret/token/URL keys, HTTP(S) values, and unsafe non-JSON values; tokens, digests, links, sessions, and email bodies are not retained.
- Owner-readable history displays actor, target, business, safe changes, and timestamp after the same tenant administration authorization.
- Serialized administration reads avoid the PostgreSQL client query-overlap warning.

## Executable evidence

- PR #22 run `30427561733`, job `90497258414`, passed hardening regression, production, Docker, and runtime gates; merge `da1e313244fff647c25ca7aedd1ff7a6f78a54e7`.
- PR #23 run `30429920983`, job `90504549396`, passed the production browser workflow and all prior gates; merge `d1627ca55ca4563f9588a60cff96889bda6f365a`.
- PR #24 run `30432096576`, job `90511416006`, passed migration history/diff/catalog, base upgrade, application, browser, Docker, and runtime gates; merge `acd0c8eb48d110ed8995842ece3e263a84826af9`.
- PR #25 final exact-head run `30440271034`, job `90537656256`, passed clean dependency installation, Prisma generation, all migrations, clean migration history/diff/catalog verification, real base-to-head upgrade preservation, lint, strict TypeScript, unit tests, PostgreSQL integration tests, production build, owner access-history Playwright verification, Compose validation, both Docker image builds, runtime boot, database readiness, and protected outbox smoke; merge `f13644c3d6248bf074647377b65910af8447ad9a`.

This evidence does not replace coordinated restoration drills.

## Non-blocking follow-up

- Party, catalog, file, business-audit, and tenant-access registers use fixed caps instead of pagination.
- Contacts and addresses cannot yet be fully edited or removed.
- Party/catalog/import changes are not comprehensively audited.
- File attachments accept arbitrary entity identifiers.
- OOXML validation checks ZIP signatures rather than internal structure.
- Multipart uploads are buffered before application-level size validation; deployment request limits remain required.
- Entitlement value-type constraints and subscription date enforcement remain incomplete.
- Full coordinated restore drills remain operational work.

These gaps do not weaken a posted accounting transaction because Phase 4 posting does not yet exist. They remain tracked and must be revisited before the affected modules are declared production-complete.

## Phase 4 entry sequence

1. Implement tenant/business-scoped chart structure and account lifecycle without transaction entry.
2. Add account classes/types, codes, names, normal balances, control-account rules, activation, and safe deactivation/archive behavior.
3. Add explicit default chart templates and setup evidence.
4. Implement accounting periods and locks.
5. Implement one central balanced posting kernel with idempotency and reversals.
6. Add PostgreSQL integration tests for balance, scope, lock, retry, correction, and reversal invariants before exposing journals or document posting.