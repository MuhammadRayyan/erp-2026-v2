# Progress

Last updated: July 27, 2026
Current branch: `phase-3-parties`
Current phase: Phase 3 — Shared business foundations

## Verified state

- Phase 1 application foundation merged with strict CI verification.
- Phase 2 database, session, onboarding, tenant-isolation, authenticated workspace, tenant administration, invitations, member management, capability enforcement, setup documentation, Docker operability, SMTP delivery, password recovery, plans, entitlements, overrides, and usage limits are merged and verified through PRs #2–#9.
- Phase 3 business-profile foundation merged and verified through PR #10.
- Prisma 7 PostgreSQL runtime and Better Auth database sessions are active foundations.
- Composite tenant keys prevent cross-tenant business memberships in PostgreSQL.
- Business navigation and protected pages require implementation status, user capability, and tenant entitlement.
- Tenant invitations use one-time hashed tokens, SMTP delivery, explicit business grants, transactional acceptance, and tenant-locked user-limit enforcement.
- Member disablement revokes active sessions and business grants atomically.
- The internal-unlimited plan uses the same normalized subscription and entitlement path intended for future commercial plans.
- Business profiles are tenant-scoped and cover industry, legal/license identity, document language, fiscal start, and UAE VAT registration state.
- The active slice adds shared organization/individual parties, customer and supplier roles, contacts, addresses, tax identity, lifecycle state, business-scoped search, and protected creation.
- The party schema uses composite tenant/business keys and PostgreSQL foreign keys to reject cross-tenant records.
- Parties require both role capability and the `parties.core` tenant entitlement.

## Verification status

GitHub Actions is the authoritative verification environment. The active slice must pass strict `npm ci`, multi-file Prisma generation, migration deployment, lint, type checking, unit tests, PostgreSQL integration tests, production build, Compose validation, and both Docker image builds before merge.

## Next priority

1. Verify and correct the parties schema, migration, API, UI, search, role, and isolation tests.
2. Add party editing, lifecycle controls, additional contact/address management, and merge preparation.
3. Add items, services, units, and default account/tax classifications.
4. Add private file and audit/history foundations required by master data.
5. Add durable queued email records when the PostgreSQL outbox worker is introduced.

## Active blockers

- Parties and contacts verification pending through GitHub Actions.
