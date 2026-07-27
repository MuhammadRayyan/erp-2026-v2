# Progress

Last updated: July 27, 2026
Current branch: `phase-2-entitlements`
Current phase: Phase 2 — Identity and access foundation

## Verified state

- Phase 1 application foundation merged with strict CI verification.
- Phase 2 database, session, onboarding, and tenant-isolation backend merged through PR #2.
- Authenticated Account Hub, business onboarding, and protected business workspaces merged through PR #3.
- Tenant access administration, secure invitations, and role definitions merged through PR #4.
- Capability-aware navigation and server-side business page guards merged through PR #5.
- Complete first-time setup documentation, reproducible Docker targets, migration-before-web startup, and Mailpit merged through PR #6.
- SMTP invitation delivery and Better Auth password-recovery delivery merged through PR #7.
- Tenant member disable/reactivate controls, per-business role changes, invitation revocation, session revocation, and protected-owner rules merged through PR #8.
- Prisma 7 PostgreSQL runtime and Better Auth database sessions are active foundations.
- Composite tenant keys prevent cross-tenant business memberships in PostgreSQL.
- Business navigation resolves implemented modules from the live role capability registry.
- Dashboard and business settings perform server-side capability checks.
- Disabling a tenant member also disables their business grants and revokes active database sessions.
- PostgreSQL integration coverage verifies owner protection, role updates, session revocation, invitation revocation, onboarding, and cross-tenant isolation.
- The active slice adds normalized feature definitions, plans, subscriptions, plan entitlements, tenant overrides, and usage limits.
- Owner onboarding assigns the internal-unlimited plan through the same subscription path intended for later commercial plans.
- Business navigation and protected pages require both user capability and tenant feature entitlement.
- Invitation creation enforces the user limit inside the same tenant-locked PostgreSQL transaction.

## Verification status

GitHub Actions is the authoritative verification environment. This slice must pass strict `npm ci`, Prisma generation, migration deployment, lint, type checking, unit tests, PostgreSQL integration tests, production build, Compose validation, and both Docker image builds before merge.

## Next priority

1. Verify and correct the entitlement migration, resolver, override, and usage-limit CI result.
2. Close Phase 2 after all implemented tenant and business actions use authoritative permission and entitlement checks.
3. Begin Phase 3 with business setup, parties, contacts, and items/services foundations.
4. Add durable queued email records when the PostgreSQL outbox worker is introduced.

## Active blockers

- Entitlement foundation verification pending through GitHub Actions.
