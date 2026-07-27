# Progress

Last updated: July 27, 2026
Current branch: `main`
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
- Existing businesses were backfilled and new onboarding creates profiles atomically.
- Registered VAT profiles require a 15-digit TRN and effective date at application and PostgreSQL boundaries.
- Profile updates require settings management capability and the core settings entitlement; view-only roles remain read-only.
- PostgreSQL integration coverage verifies onboarding, tenant isolation, invitations, owner protection, role updates, session revocation, entitlement resolution, overrides, usage limits, profile validation, and profile authorization.

## Verification status

PR #10 passed strict `npm ci`, Prisma generation, migration deployment, lint, type checking, unit tests, PostgreSQL integration tests, production build, Compose validation, and migration/runtime Docker image builds before merge.

## Next priority

1. Add shared parties and contacts with customer/supplier roles, addresses, tax identity, lifecycle, and tenant-safe search.
2. Add items, services, units, and default account/tax classifications.
3. Add private file and audit/history foundations required by master data.
4. Add durable queued email records when the PostgreSQL outbox worker is introduced.

## Active blockers

- None for the completed business-profile slice.
