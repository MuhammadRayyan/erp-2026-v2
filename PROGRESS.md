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
- Prisma 7 PostgreSQL runtime and Better Auth database sessions are active foundations.
- Prisma uses a multi-file schema layout so bounded domains can evolve without one oversized schema file.
- Composite tenant keys protect operational master data, import batches, stored-file metadata, and file attachments in PostgreSQL.
- Business navigation and protected pages require implementation status, user capability, and tenant entitlement.
- Private objects remain outside PostgreSQL and the public web root; PostgreSQL stores metadata, scope, hashes, and append-only audit events.
- Local and Docker storage use generated opaque keys, allowlisted formats, byte-signature checks, size limits, SHA-256 hashes, and private non-root storage paths.
- PostgreSQL and private-file backups must be created and restored as one coordinated dataset.

## Verification status

PR #17 passed strict `npm ci`, multi-file Prisma generation, migration deployment, lint, type checking, separated unit tests, PostgreSQL integration tests, production build, Compose validation, and migration/runtime Docker image builds before merge.

## Next priority

1. Add reusable numbering and sequence foundations.
2. Add reusable export foundations.
3. Add custom-field definitions and values.
4. Add durable queued email records when the PostgreSQL outbox worker is introduced.

## Active blockers

- None for the verified private-files and audit-history foundation.
