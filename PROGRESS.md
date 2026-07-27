# Progress

Last updated: July 27, 2026
Current branch: `phase-2-email-delivery`
Current phase: Phase 2 — Identity and access foundation

## Verified state

- Phase 1 application foundation merged with strict CI verification.
- Phase 2 database, session, onboarding, and tenant-isolation backend merged through PR #2.
- Authenticated Account Hub, business onboarding, and protected business workspaces merged through PR #3.
- Tenant access administration, secure invitations, and role definitions merged through PR #4.
- Capability-aware navigation and server-side business page guards merged through PR #5.
- Complete first-time setup documentation, reproducible Docker targets, migration-before-web startup, and Mailpit merged through PR #6.
- Prisma 7 PostgreSQL runtime and Better Auth database sessions are active foundations.
- Composite tenant keys prevent cross-tenant business memberships in PostgreSQL.
- Business navigation resolves implemented modules from the live role capability registry.
- Dashboard and business settings perform server-side capability checks.
- The active slice adds an SMTP platform email adapter compatible with local Mailpit and hosted SMTP providers.
- Invitation links are delivered by email and are no longer returned to the browser for manual sharing.
- Better Auth password-reset delivery, one-hour reset expiry, and session revocation are configured.
- Forgot-password and reset-password UI flows are implemented.

## Verification status

GitHub Actions is the authoritative verification environment. This slice must pass strict dependency installation, Prisma generation, migration deployment, lint, type checking, unit tests, PostgreSQL integration tests, production build, Compose validation, and both Docker image builds before merge.

## Next priority

1. Generate and commit the updated package lock for Nodemailer.
2. Verify and correct invitation and password-reset delivery through CI.
3. Add durable queued delivery records when the PostgreSQL outbox worker is introduced.
4. Add member disablement, role changes, invitation revocation, and owner-protection rules.
5. Close Phase 2 and begin Phase 3 shared business setup and master-data foundations.

## Active blockers

- SMTP dependency lockfile and full delivery-flow verification pending through GitHub Actions.
