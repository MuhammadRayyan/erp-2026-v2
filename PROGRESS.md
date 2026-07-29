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
- PR #22 merged the blocking corrections found by the independent Phase 3 audit: invitation role/lifecycle/scope, tenant administration entitlement gates, catalog reactivation, numbering settings/idempotency/void concurrency, import decision and target staleness, local worker setup, infrastructure exposure, and business-profile audit coverage.
- The final PR #22 run `30427561733`, job `90497258414`, passed clean dependency installation, Prisma generation, all migrations, lint, type checking, unit tests, 60 PostgreSQL integration tests, production build, Compose validation, both Docker image builds, runtime-container boot, database readiness, and the protected outbox smoke request.

## Audit correction

The prior declaration that Phase 3 was complete was premature. `PHASE_3_VERIFICATION_AUDIT.md` records the code-level findings, corrective evidence, and remaining gaps. `PROGRESS.md` and `CHANGELOG.md` are not treated as proof by themselves.

## Verified hardening merged through PR #22

- Aligned module phase metadata with the authoritative roadmap and added a regression test.
- Rejected protected owner invitation grants and persisted invitation expiry correctly.
- Enforced `users.manage` within tenant administration services.
- Added composite invitation/grant tenant scope in Prisma and PostgreSQL.
- Revalidated invitation correlation before queued delivery and tightened email idempotency.
- Cancelled older queued password resets when a new request is created.
- Serialized catalog item edits/reactivation with unit lifecycle changes.
- Serialized numbering settings with allocation, froze unsafe post-use policy changes, validated retry equivalence, and locked void transitions.
- Serialized import row decisions with commit and rejected stale update targets.
- Added sensitive business-profile audit events.
- Bound PostgreSQL and Mailpit host ports to loopback, added database-aware readiness, and made the worker wait for a healthy web service.
- Added focused regression tests and a booted-runtime CI smoke gate.
- Reconciled README, security guidance, decisions, changelog, and the Phase 3 audit.

## Remaining Phase 3 priorities

1. Add Playwright browser E2E for sign-up, onboarding, authorization, parties, catalog, files, invitations, password reset, and queued Mailpit delivery.
2. Add migration-drift protection and reconcile remaining critical manually enforced composite constraints with Prisma models.
3. Add a tenant-level access audit trail for invitation, membership, role, disable/reactivate, and acceptance events.
4. Re-run unit, PostgreSQL, browser, runtime, Docker, and migration verification from a clean branch.
5. Reassess Phase 3 from evidence before enabling Phase 4.

## Tracked non-blocking follow-up

- Pagination for capped party, catalog, file, and audit lists.
- Full contact/address editing and removal.
- Broader party/catalog/import audit coverage.
- File attachment target validation, stronger OOXML inspection, deployment request-size limits, and restore drills.
- Entitlement value-type constraints and subscription start/end-date enforcement.

## Active blockers

- Phase 4 remains blocked by browser E2E, migration-drift protection, and tenant access-change auditing.
- No accounting transaction should be exposed until Phase 3 is explicitly re-verified and chart structure, periods, posting invariants, and reversal policy are implemented and integration-tested.
