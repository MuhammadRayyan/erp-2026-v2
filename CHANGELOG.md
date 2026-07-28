# Changelog

## Unreleased

### Added

- Initial project context and phased ERP plan.
- Next.js application with real account, business, and platform route areas.
- Warm light and charcoal dark design tokens.
- Shared Account and Business shells.
- Central module/capability registry foundation.
- Representative Account Hub, Dashboard, Business Settings, and Platform pages.
- Initial tenant, business, tenant-membership, and business-membership data model.
- Docker Compose and GitHub Actions verification workflow.
- Module-registry unit tests.
- Environment contract validation and unit tests.
- Non-cached health endpoint for deployment checks.
- Prisma 7 PostgreSQL runtime adapter and singleton database client.
- Better Auth with PostgreSQL-backed sessions and the Next.js auth handler.
- Explicit idempotent owner onboarding.
- Server-side business access context.
- Database-enforced prevention of cross-tenant business memberships.
- PostgreSQL integration tests for onboarding and access isolation.
- Modern sign-in and sign-up pages.
- Authenticated Account Hub with real business memberships.
- Explicit business onboarding UI and validated request contract.
- Business-specific protected workspace routes and live workspace identity.
- Sign-out controls and empty-business onboarding state.
- Authoritative business-role and capability registry.
- Tenant owner users-and-access administration page.
- Email-bound, expiring tenant invitations with one-time hashed tokens.
- Business-specific invitation grants and transactional acceptance.
- Integration coverage for invitation email matching, cross-tenant grant rejection, and role capabilities.
- Reusable server-side business page capability guard.
- Complete first-time setup, local development, Docker, environment, database, migration, testing, and troubleshooting guide.
- Mailpit service for local invitation and password-recovery email inspection.
- Dedicated Docker migration image target and migration-before-web Compose service.
- Database, Prisma Studio, and infrastructure helper scripts.
- Optional validated SMTP configuration for the platform email adapter.
- Nodemailer-backed platform SMTP adapter.
- Email delivery for tenant invitations without exposing invitation tokens to the browser.
- Better Auth forgot-password and reset-password delivery.
- One-hour password reset links with revocation of existing sessions after reset.
- Modern forgot-password and reset-password pages.
- HTML escaping coverage for dynamic platform email values.
- Tenant-owner controls for member disablement and reactivation.
- Per-business role changes using the authoritative role registry.
- Pending invitation revocation.
- Owner-protection and session-revocation integration tests.
- Normalized feature definitions, plans, plan entitlements, tenant subscriptions, entitlement overrides, and usage limits.
- Internal-unlimited plan assigned through the normal tenant subscription path.
- Tenant entitlement resolver with boolean feature and numeric/unlimited limit handling.
- Transactional, tenant-locked user-limit enforcement for invitation creation.
- Entitlement override and plan-resolution integration tests.
- Tenant-scoped business profile for industry, legal/license, document language, fiscal, and UAE VAT registration settings.
- Backfill migration and atomic onboarding creation for business profiles.
- Registered-VAT validation at application and PostgreSQL constraint boundaries.
- Protected business-profile API and modern editable/read-only settings experience.
- Integration coverage for profile defaults, valid VAT setup, invalid registration, and role protection.
- Multi-file Prisma schema organization for bounded domain models.
- Shared parties for organizations and individuals with customer, supplier, or dual roles.
- Primary party contacts and billing, delivery, site, or other addresses.
- Tenant-safe party search by name, email, phone, or TRN.
- Protected parties API, register page, creation form, capability definitions, and entitlement.
- PostgreSQL tests for dual roles, search, read-only denial, and cross-tenant rejection.
- Protected party detail pages with editable identity, roles, notes, and lifecycle state.
- Multiple party contacts and typed addresses with primary/default selection.
- Integration coverage for party editing, lifecycle changes, related records, and cross-tenant detail denial.

### Changed

- Tenant and business membership schema now uses composite tenant keys to enforce isolation in PostgreSQL.
- CI now provisions PostgreSQL, deploys migrations, and runs integration tests.
- Demo business navigation was replaced by authenticated business-specific URLs.
- Legacy static workspace URLs now redirect to the Account Hub.
- Account Hub now exposes tenant access administration only to tenant owners.
- Business navigation now displays only implemented modules permitted by both the active role and tenant plan.
- Dashboard and business settings now enforce capabilities and feature entitlements on the server.
- Business settings queries now use tenant-scoped composite identity.
- Docker dependency installation now uses the committed lockfile and `npm ci`.
- Full Docker startup now waits for PostgreSQL health and successful migration deployment before starting the web service.
- Tenant invitation creation now reports delivery status instead of returning a reusable secret link.
- Disabling a tenant member now disables their business grants and removes active sessions atomically.
- Account Hub business cards now show the resolved tenant plan.
- Business settings now provide structured profile editing instead of a static summary-only screen.
- README project status now reflects Phase 3 rather than the completed Phase 2.
- Party register cards now open direct, protected detail URLs.
