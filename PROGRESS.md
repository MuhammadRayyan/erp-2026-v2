# Progress

Last updated: July 27, 2026
Current branch: `phase-3-business-profile`
Current phase: Phase 3 — Shared business foundations

## Verified state

- Phase 1 application foundation merged with strict CI verification.
- Phase 2 database, session, onboarding, tenant-isolation, authenticated workspace, tenant administration, invitations, member management, capability enforcement, setup documentation, Docker operability, SMTP delivery, password recovery, plans, entitlements, overrides, and usage limits are merged and verified through PRs #2–#9.
- Prisma 7 PostgreSQL runtime and Better Auth database sessions are active foundations.
- Composite tenant keys prevent cross-tenant business memberships in PostgreSQL.
- Business navigation and protected pages require implementation status, user capability, and tenant entitlement.
- Tenant invitations use one-time hashed tokens, SMTP delivery, explicit business grants, transactional acceptance, and tenant-locked user-limit enforcement.
- Member disablement revokes active sessions and business grants atomically.
- The internal-unlimited plan uses the same normalized subscription and entitlement path intended for future commercial plans.
- PostgreSQL integration coverage verifies onboarding, tenant isolation, invitations, owner protection, role updates, session revocation, entitlement resolution, overrides, and usage limits.
- The active Phase 3 slice adds a tenant-scoped one-to-one business profile for industry, legal/license, document language, fiscal, and UAE VAT registration settings.
- Existing businesses receive a backfilled default profile; new onboarding creates the profile atomically.
- Registered VAT profiles require a 15-digit TRN and VAT effective date at both application and database boundaries.
- Profile updates require settings management capability and the core settings entitlement; view-only roles remain read-only.

## Verification status

GitHub Actions is the authoritative verification environment. This slice must pass strict `npm ci`, Prisma generation, migration deployment, lint, type checking, unit tests, PostgreSQL integration tests, production build, Compose validation, and both Docker image builds before merge.

## Next priority

1. Verify and correct the business-profile migration, validation, API, UI, and access tests.
2. Add shared parties and contacts.
3. Add items, services, units, and default account/tax classifications.
4. Add private file and audit/history foundations required by master data.
5. Add durable queued email records when the PostgreSQL outbox worker is introduced.

## Active blockers

- Business-profile foundation verification pending through GitHub Actions.
