# Progress

Last updated: July 27, 2026
Current branch: `phase-2-email-setup-docs`
Current phase: Phase 2 — Identity and access foundation

## Verified state

- Phase 1 application foundation merged with strict CI verification.
- Phase 2 database, session, onboarding, and tenant-isolation backend merged through PR #2.
- Authenticated Account Hub, business onboarding, and protected business workspaces merged through PR #3.
- Tenant access administration, secure invitations, and role definitions merged through PR #4.
- Capability-aware navigation and server-side business page guards merged through PR #5.
- Prisma 7 PostgreSQL runtime and Better Auth database sessions are active foundations.
- Composite tenant keys prevent cross-tenant business memberships in PostgreSQL.
- Business navigation resolves implemented modules from the live role capability registry.
- Dashboard and business settings perform server-side capability checks.
- The active slice replaces the placeholder README with complete first-time setup, local development, Docker, environment, database, migration, testing, health, and troubleshooting instructions.
- Docker now has reproducible npm installation, a dedicated migration target, migration-before-web startup, PostgreSQL health ordering, and Mailpit for local email inspection.
- Optional SMTP environment settings are validated and documented for the invitation and recovery delivery slice.

## Verification status

GitHub Actions is the authoritative verification environment. This slice must pass strict `npm ci`, Prisma generation, migration deployment, lint, type checking, unit tests, PostgreSQL integration tests, and production build before merge. Docker image targets and Compose configuration must also parse and build successfully.

## Next priority

1. Verify and correct the README, environment, Docker migration, and Mailpit slice.
2. Add the platform email adapter and connect invitation delivery.
3. Add password-recovery email delivery through Better Auth.
4. Add member disablement, role changes, invitation revocation, and owner-protection rules.
5. Close Phase 2 and begin Phase 3 shared business setup and master-data foundations.

## Active blockers

- Setup and Docker operability verification pending through GitHub Actions.
