# Progress

Last updated: July 27, 2026
Current branch: `phase-2-tenant-admin-invitations`
Current phase: Phase 2 — Identity and access foundation

## Verified state

- Phase 1 application foundation merged with strict CI verification.
- Phase 2 database, session, onboarding, and tenant-isolation backend merged through PR #2.
- Authenticated Account Hub, business onboarding, and protected business workspaces merged through PR #3.
- Prisma 7 PostgreSQL runtime and Better Auth database sessions are active foundations.
- Composite tenant keys prevent cross-tenant business memberships in PostgreSQL.
- The active slice adds an authoritative role/capability registry.
- Tenant invitations use one-time random tokens stored only as SHA-256 digests.
- Invitations are email-bound, expiring, and limited to explicit business/role grants.
- Tenant owners receive a users-and-access administration page.
- Invitation acceptance creates tenant and business memberships transactionally.

## Verification status

GitHub Actions is the authoritative verification environment. This slice must pass strict `npm ci`, Prisma generation, migration deployment, lint, type checking, unit tests, PostgreSQL integration tests, and production build before merge.

## Next priority

1. Verify and correct the tenant invitation and capability CI result.
2. Add invitation delivery through the platform email adapter and password-recovery delivery.
3. Add member disablement, role changes, invitation revocation, and owner-protection rules.
4. Apply capability checks to business navigation and the first protected settings use cases.
5. Close Phase 2 and begin shared business setup and master-data foundations.

## Active blockers

- Tenant invitation and role/capability verification pending through GitHub Actions.
