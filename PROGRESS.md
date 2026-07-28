# Progress

Last updated: July 28, 2026
Current branch: `main`
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

## Next priority

1. Add durable queued email records and the PostgreSQL outbox worker foundation.
2. Reassess Phase 3 completion after the outbox foundation is verified.
3. Begin the Phase 4 accounting kernel only after all shared foundations are complete and documented.

## Active blockers

- None for the verified custom-field foundation.
