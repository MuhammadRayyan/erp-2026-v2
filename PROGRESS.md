# Progress

Last updated: July 29, 2026
Current branch: `phase-3-email-outbox`
Current phase: Phase 3 — Shared business foundations

## Verified state

- Phase 1 application foundation merged with strict CI verification.
- Phase 2 database, session, onboarding, tenant-isolation, authenticated workspace, tenant administration, invitations, member management, capability enforcement, setup documentation, Docker operability, SMTP delivery, password recovery, plans, entitlements, overrides, and usage limits are merged and verified through PRs #2–#9.
- Phase 3 business-profile foundation merged and verified through PR #10.
- Shared parties and contacts foundation merged and verified through PR #11.
- Party detail/editing, lifecycle controls, multiple contacts and addresses, and primary/default selection merged and verified through PR #12.
- Party duplicate detection, persisted review decisions, primary/default uniqueness constraints, serialized related-record updates, and stable not-found behavior merged and verified through PR #13.
- Products, services, units, exact default prices, preparatory account/tax classifications, catalog RBAC, entitlement enforcement, and tenant isolation merged and verified through PR #14.
- Catalog detail editing, item activation, safe unit lifecycle controls, and unit-row serialization merged and verified through PR #15.
- Staged catalog CSV preview, persisted row decisions, explicit conflict resolution, and transactional create/update commit merged and verified through PR #16.
- Private file metadata, adapter-based local storage, authenticated upload/download, attachment links, audit history, backup guidance, and tenant isolation merged and verified through PR #17.
- Reusable document numbering, configurable sequences, locked idempotent allocation, immutable formatted history, void preservation, settings UI, and concurrency coverage merged and verified through PR #18.
- Reusable controlled CSV exports, filtered party and catalog adapters, immutable run metadata, checksums, audit events, and tenant isolation merged and verified through PR #19.
- Typed custom-field definitions and values for parties and catalog items, settings administration, target locking, audit events, and tenant isolation merged and verified through PR #20.
- Prisma 7 PostgreSQL runtime and Better Auth database sessions are active foundations.
- Prisma uses a multi-file schema layout so bounded domains can evolve without one oversized schema file.
- Composite tenant keys protect operational master data, imports, private files, numbering, exports, custom-field definitions, and custom-field values in PostgreSQL.
- Business navigation and protected pages require implementation status, user capability, and tenant entitlement.
- Private objects remain outside PostgreSQL and the public web root; PostgreSQL stores metadata, scope, hashes, and append-only audit events.
- Number allocations use explicit effective dates, stable idempotency keys, PostgreSQL row locking, stored numeric and formatted values, and never reuse voided identifiers.
- CSV exports require dedicated export permission plus dataset view permission, fail above 5,000 rows, neutralize spreadsheet formulas, and retain metadata and checksums without retaining generated payloads.
- Custom-field keys and value types are immutable; operational values use typed columns, required fields are enforced during save, and used select options cannot be removed.

## Verification status

PR #20 passed strict `npm ci`, multi-file Prisma generation, migration deployment, lint, type checking, separated unit tests, PostgreSQL integration tests for all supported field types and isolation boundaries, production build, Compose validation, and migration/runtime Docker image builds before merge.

The email-outbox slice is implemented on `phase-3-email-outbox` and must pass the same strict gate before merge.

## Current implementation slice

- Durable queued records for tenant invitations, password resets, and future system email.
- Transactional invitation creation and enqueueing.
- Idempotent queue writes with correlation metadata and explicit expiry.
- PostgreSQL `FOR UPDATE SKIP LOCKED` claiming for safe concurrent workers.
- Bounded exponential retries, attempt budgets, stale-lock recovery, and terminal states.
- Payload scrubbing after sent, failed, expired, or cancelled outcomes.
- Secret-protected internal processing endpoint.
- Host-development worker command and lightweight Docker Compose worker service.
- Tenant-owner visibility into invitation delivery state and retry count.
- Invitation acceptance and revocation cancellation for undelivered messages.
- Unit and PostgreSQL integration coverage for retry timing, idempotency, concurrency, expiry, failure, payload scrubbing, and delivery visibility.

## Next priority

1. Verify and merge the durable email outbox foundation.
2. Reassess Phase 3 completion and close any remaining shared-foundation gaps.
3. Begin the Phase 4 accounting kernel only after Phase 3 is explicitly complete and documented.

## Active blockers

- CI verification is pending for the email-outbox foundation.
