# Progress

Last updated: July 29, 2026
Current branch: `main`
Current phase: Phase 3 — Verification and hardening

## Evidence-based verified state

- Phase 1 application foundation and Phase 2 identity/access foundations are merged and covered by the repository CI gate.
- Phase 3 working foundations are merged through PRs #10–#21: business profile, parties and contacts, catalog and units, staged catalog imports, private files, audit storage, numbering, exports, custom fields, and durable queued email.
- Better Auth uses PostgreSQL-backed revocable sessions.
- Business access resolves through active tenant and business memberships and an active subscription.
- Private files are stored outside the public web root and downloaded through authenticated no-store routes.
- Controlled exports are scoped, spreadsheet-safe, bounded, and audited without retaining generated payloads.
- PR #22 merged the independent hardening corrections for invitations, entitlements, catalog lifecycle, numbering, imports, setup, infrastructure exposure, and profile auditing.
- PR #22 run `30427561733`, job `90497258414`, passed migration, unit, PostgreSQL, production, Docker, runtime, readiness, and outbox gates.
- PR #23 merged Playwright verification against the production build, real PostgreSQL, Mailpit, email worker, private files, and cookie sessions.
- PR #23 run `30429920983`, job `90504549396`, passed the complete owner/viewer browser workflow plus every existing gate. PR #23 merged as `d1627ca55ca4563f9588a60cff96889bda6f365a`.
- PR #24 merged clean-install and base-to-head migration integrity protection while preserving all existing application and runtime gates.
- PR #24 run `30432096576`, job `90511416006`, passed clean migration status, empty supported-object schema diff, PostgreSQL catalog integrity, base-to-head upgrade preservation, lint, strict TypeScript, unit tests, 60 PostgreSQL integration tests, production build, Playwright E2E, Compose validation, both Docker image builds, runtime boot, readiness, and protected outbox smoke. PR #24 merged as `acd0c8eb48d110ed8995842ece3e263a84826af9`.

## Audit correction

The prior declaration that Phase 3 was complete was premature. `PHASE_3_VERIFICATION_AUDIT.md` records the findings, corrective evidence, and remaining gap. Progress and changelog statements are not proof by themselves.

## Verified hardening merged through PR #22

- Aligned module phase metadata with the authoritative roadmap.
- Rejected protected owner invitations and persisted expiry correctly.
- Enforced tenant administration entitlements in services.
- Added composite invitation tenant scope.
- Revalidated queued invitation delivery and tightened idempotency.
- Cancelled older password-reset deliveries.
- Serialized catalog lifecycle, numbering administration, voids, and import decisions.
- Added profile audit events, loopback infrastructure binding, readiness, regression tests, and runtime smoke verification.

## Verified browser slice merged through PR #23

- Added reproducible Playwright/Chromium verification.
- Verified anonymous denial, owner onboarding, party/catalog creation, private upload/download, invitation delivery/acceptance, viewer read-only enforcement, password reset, session revocation, and reauthentication.
- Added browser failure artifacts.
- Fixed the party-create form’s asynchronous element-lifetime defect.
- Preserved all prior unit, PostgreSQL, build, Compose, Docker, readiness, and outbox gates.

## Verified migration integrity merged through PR #24

- Reconciled the multi-file Prisma schema with live supported foreign keys, relation names, unique/index names, and the party trigram GIN operator class.
- Added reverse Business, Tenant, and User relations for existing database keys without adding duplicate constraints or requiring a migration.
- Required clean `prisma migrate status` and an empty schema-to-database diff.
- Added a fail-closed catalog manifest for 26 critical composite keys, 34 business checks, three custom indexes, the custom-field trigger/function, and `pg_trgm`.
- Added a second pull-request database built from the exact base commit.
- Seeded representative user, owner membership, tenant, business, unit, and party records before applying head migrations.
- Re-ran migration status, schema diff, catalog integrity, and sentinel preservation after base-to-head upgrade.
- Added `MIGRATION_INTEGRITY.md`, ADR-018, npm commands, and setup guidance.

## Remaining Phase 3 priority

1. Add immutable tenant-level access events for invitation creation/supersession/revocation/expiry/acceptance, member disable/reactivate, role changes, and administration-driven session revocation.
2. Expose protected owner-readable tenant access history.
3. Re-run migration, unit, PostgreSQL, browser, Docker, and runtime verification from a clean branch.
4. Reassess Phase 3 from evidence before enabling Phase 4.

## Tracked non-blocking follow-up

- Pagination for capped party, catalog, file, and audit lists.
- Full contact/address editing and removal.
- Broader party/catalog/import audit coverage.
- File target validation, stronger OOXML inspection, deployment request-size limits, and restore drills.
- Entitlement value-type constraints and subscription date enforcement.

## Active blocker

- Phase 4 remains blocked by tenant access-change auditing and the final complete Phase 3 reassessment.
- No accounting transaction should be exposed until chart structure, periods, posting invariants, and reversal policy are implemented and integration-tested.
