# Progress

Last updated: July 29, 2026
Current branch: `main`
Current phase: Phase 4 — Accounting kernel

## Verified state

- Phase 1 application foundation merged with strict CI verification.
- Phase 2 identity, tenancy, sessions, invitations, RBAC, capabilities, entitlements, limits, setup documentation, SMTP integration, and access administration merged and verified through PRs #2–#9.
- Phase 3 business onboarding and settings, parties, contacts, items, services, units, custom fields, private files, numbering, lists, forms, staged imports, controlled exports, audit/history, and durable queued email foundations merged and verified through PRs #10–#21.
- Business-profile and UAE registration settings merged through PR #10.
- Shared parties, related records, lifecycle management, integrity constraints, and duplicate review merged through PRs #11–#13.
- Products, services, units, lifecycle controls, and staged catalog imports merged through PRs #14–#16.
- Private file storage, attachments, audit history, and coordinated backup guidance merged through PR #17.
- Reusable document numbering with locked idempotent allocation and immutable history merged through PR #18.
- Controlled filtered CSV exports with safe serialization, immutable run metadata, checksums, and audit events merged through PR #19.
- Typed custom-field definitions and values with target locking, settings administration, and tenant isolation merged through PR #20.
- Durable PostgreSQL email outbox, concurrent worker claiming, retries, expiry, payload scrubbing, invitation/password-reset integration, and worker operations merged through PR #21.
- Prisma 7 PostgreSQL runtime and Better Auth database sessions are active foundations.
- Prisma uses a multi-file schema layout so bounded domains can evolve without one oversized schema file.
- Composite tenant keys protect operational records and shared foundations in PostgreSQL.
- Business navigation and protected pages require implementation status, user capability, and tenant entitlement.
- Private objects remain outside PostgreSQL and the public web root; PostgreSQL stores metadata, scope, hashes, and append-only audit events.
- Number allocations use explicit effective dates, stable idempotency keys, PostgreSQL row locking, immutable formatted values, and no reuse after voiding.
- CSV exports require dedicated export permission plus dataset view permission, fail above 5,000 rows, neutralize spreadsheet formulas, and retain metadata without retaining generated payloads.
- Custom-field keys and types are immutable; operational values use typed columns, required fields are enforced during save, and used select options cannot be removed.
- Email delivery work is persisted before request completion, claimed with `FOR UPDATE SKIP LOCKED`, retried with bounded backoff, and scrubbed after terminal outcomes.
- Serializable owner onboarding now retries bounded PostgreSQL write conflicts while preserving idempotency.

## Verification status

PR #21 passed strict `npm ci`, multi-file Prisma generation, migration deployment, lint, type checking, separated unit tests, PostgreSQL integration tests including concurrent workers and parallel onboarding, production build, Compose validation including the worker service, and migration/runtime Docker image builds before merge.

Phase 3 is complete according to the `MODULES_AND_PHASES.md` completion scope. Its shared foundations are implemented as working, protected, migrated, tested workflows rather than file-only scaffolding.

## Next priority

1. Begin Phase 4 with chart-of-accounts foundations and account lifecycle rules.
2. Add accounting periods and lock foundations before journal posting is exposed.
3. Build the central double-entry journal and posting-policy kernel with exact decimals, balanced transactions, idempotency, reversals, and immutable posted history.
4. Add opening balances, receivables/payables foundations, allocations, multi-currency controls, and core reports only in the documented accounting sequence.

## Active blockers

- None for the completed Phase 3 shared foundations.
- No accounting transaction should be exposed until chart structure, periods, posting invariants, and reversal policy are implemented and integration-tested.
