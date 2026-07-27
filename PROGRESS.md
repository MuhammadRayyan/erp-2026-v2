# Progress

Last updated: July 27, 2026
Current branch: `phase-2-member-management`
Current phase: Phase 2 — Identity and access foundation

## Verified state

- Phase 1 application foundation merged with strict CI verification.
- Phase 2 database, session, onboarding, and tenant-isolation backend merged through PR #2.
- Authenticated Account Hub, business onboarding, and protected business workspaces merged through PR #3.
- Tenant access administration, secure invitations, and role definitions merged through PR #4.
- Capability-aware navigation and server-side business page guards merged through PR #5.
- Complete first-time setup documentation, reproducible Docker targets, migration-before-web startup, and Mailpit merged through PR #6.
- SMTP invitation delivery and Better Auth password-recovery delivery merged through PR #7.
- Prisma 7 PostgreSQL runtime and Better Auth database sessions are active foundations.
- Composite tenant keys prevent cross-tenant business memberships in PostgreSQL.
- Business navigation resolves implemented modules from the live role capability registry.
- Dashboard and business settings perform server-side capability checks.
- The active slice adds tenant-owner member disable/reactivate controls, per-business role changes, pending invitation revocation, and protected-owner rules.
- Disabling a tenant member also disables their business grants and revokes active database sessions.
- PostgreSQL integration coverage verifies owner protection, role updates, session revocation, and invitation revocation.

## Verification status

GitHub Actions is the authoritative verification environment. This slice must pass strict npm installation, Prisma generation, migration deployment, lint, type checking, unit tests, PostgreSQL integration tests, production build, Compose validation, and both Docker image builds before merge.

## Next priority

1. Verify and correct the member-management CI result.
2. Add explicit entitlement and plan foundations required to close Phase 2.
3. Add durable queued email records when the PostgreSQL outbox worker is introduced.
4. Close Phase 2 after all implemented tenant and business actions use authoritative capability checks.
5. Begin Phase 3 business setup, parties, contacts, and items/services foundations.

## Active blockers

- Member management and owner-protection verification pending through GitHub Actions.
