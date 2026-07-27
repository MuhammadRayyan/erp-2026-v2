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

### Changed

- Tenant and business membership schema now uses composite tenant keys to enforce isolation in PostgreSQL.
- CI now provisions PostgreSQL, deploys migrations, and runs integration tests.
- Demo business navigation was replaced by authenticated business-specific URLs.
- Legacy static workspace URLs now redirect to the Account Hub.
- Account Hub now exposes tenant access administration only to tenant owners.
- Business navigation now displays only implemented modules permitted by the active role.
- Dashboard and business settings now enforce capabilities on the server.
- Business settings queries now use tenant-scoped composite identity.
