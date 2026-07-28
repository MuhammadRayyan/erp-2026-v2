# Progress

Last updated: July 28, 2026
Current branch: `phase-3-export-foundation`
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
- Prisma 7 PostgreSQL runtime and Better Auth database sessions are active foundations.
- Prisma uses a multi-file schema layout so bounded domains can evolve without one oversized schema file.
- Composite tenant keys protect operational master data, import batches, stored-file metadata, file attachments, numbering sequences, allocations, and export runs in PostgreSQL.
- Business navigation and protected pages require implementation status, user capability, and tenant entitlement.
- Private objects remain outside PostgreSQL and the public web root; PostgreSQL stores metadata, scope, hashes, and append-only audit events.
- Local and Docker storage use generated opaque keys, allowlisted formats, byte-signature checks, size limits, SHA-256 hashes, and private non-root storage paths.
- PostgreSQL and private-file backups must be created and restored as one coordinated dataset.
- Number allocations use explicit effective dates, stable idempotency keys, PostgreSQL row locking, stored numeric and formatted values, and never reuse voided identifiers.

## Verification status

PR #18 passed strict `npm ci`, multi-file Prisma generation, migration deployment, lint, type checking, separated unit tests, PostgreSQL integration tests including concurrent allocation, production build, Compose validation, and migration/runtime Docker image builds before merge.

The reusable export slice is implemented on `phase-3-export-foundation` and must pass the same strict gate before merge.

## Current implementation slice

- Dedicated `exports.core` entitlement and `exports.run` capability.
- Dataset-specific view permission checks in addition to export permission.
- Reusable party and catalog CSV dataset adapters with explicit filter schemas.
- UTF-8 CSV with deterministic columns, quoting, CRLF line endings, and spreadsheet formula neutralization.
- Synchronous 5,000-row hard ceiling with explicit failure instead of silent truncation.
- POST-only authenticated non-cacheable downloads with no filter values in URLs.
- Export-run metadata containing filters, actor, row count, file name, and SHA-256 checksum while CSV payloads are not retained.
- Append-only export audit events and a protected export-history workspace.
- Filter-preserving export controls on party and catalog registers.
- Unit and PostgreSQL integration coverage for CSV safety, row limits, filtered results, exact decimal text, RBAC, entitlements, checksums, audit events, and tenant isolation.

## Next priority

1. Verify and merge reusable export foundations.
2. Add custom-field definitions and values.
3. Add durable queued email records when the PostgreSQL outbox worker is introduced.

## Active blockers

- CI verification is pending for the reusable export foundation.
