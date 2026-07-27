# Progress

Last updated: July 27, 2026
Current branch: `main`
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

## Verification status

PR #8 passed strict `npm ci`, Prisma generation, migration deployment, lint, type checking, unit tests, PostgreSQL integration tests, production build, Compose validation, and migration/runtime Docker image builds before merge.

## Next priority

1. Add explicit feature, plan, entitlement, and usage-limit foundations required to close Phase 2.
2. Apply entitlement checks alongside capabilities for every implemented module and protected action.
3. Add durable queued email records when the PostgreSQL outbox worker is introduced.
4. Close Phase 2 after entitlement and implemented-action coverage is verified.
5. Begin Phase 3 business setup, parties, contacts, and items/services foundations.

## Active blockers

- None for the merged identity, access, setup, email-delivery, or member-management foundations.
