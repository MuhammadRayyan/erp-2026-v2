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
- Prisma 7 PostgreSQL runtime and Better Auth database sessions are active foundations.
- Prisma uses a multi-file schema layout so bounded domains can evolve without one oversized schema file.
- Composite tenant keys prevent cross-tenant business memberships, parties, contacts, addresses, party roles, duplicate-review pairs, catalog records, units, and catalog-import batches in PostgreSQL.
- Business navigation and protected pages require implementation status, user capability, and tenant entitlement.
- Tenant invitations use one-time hashed tokens, SMTP delivery, explicit business grants, transactional acceptance, and tenant-locked user-limit enforcement.
- Member disablement revokes active sessions and business grants atomically.
- The internal-unlimited plan uses the same normalized subscription and entitlement path intended for future commercial plans.
- Business profiles are tenant-scoped and cover industry, legal/license identity, document language, fiscal start, and UAE VAT registration state.
- Parties support organizations and individuals, customer/supplier dual roles, protected detail pages, editable identity and roles, primary contacts, typed addresses, tax identity, active/inactive lifecycle state, business-scoped search, and explicit duplicate review.
- PostgreSQL partial unique indexes enforce one primary contact per party and one default address per address type.
- Duplicate review uses exact identifiers and trigram name similarity but never merges, deletes, or reassigns references automatically.
- Catalog records support products and services, business-scoped SKU uniqueness, exact `DECIMAL(19,4)` prices, sales/purchase availability, units, preparatory account/tax defaults, protected editing, and active/inactive lifecycle state.
- Existing and newly onboarded businesses receive Each, Hour, and Day units through migrations and the onboarding transaction.
- Active catalog operations cannot commit against units being deactivated concurrently because creation, editing, and unit lifecycle changes lock the same unit row.
- Party and catalog operations require authoritative role capabilities plus their tenant entitlements.
- Unit and PostgreSQL integration suites are separated reliably; the previous shell-expanded exclusion glob no longer runs integration files inside `npm run test`.

## Verification status

PR #15 passed strict `npm ci`, multi-file Prisma generation, migration deployment, lint, type checking, separated unit tests, PostgreSQL integration tests, production build, Compose validation, and migration/runtime Docker image builds before merge.

The staged catalog-import slice is implemented on `phase-3-catalog-imports` and must pass the same gate before merge.

## Next priority

1. Verify and merge staged catalog CSV preview, conflict resolution, and transactional commit.
2. Add private file and audit/history foundations required by master data.
3. Add reusable numbering, export, and custom-field foundations.
4. Add durable queued email records when the PostgreSQL outbox worker is introduced.

## Active blockers

- CI verification is pending for the catalog-import slice.
