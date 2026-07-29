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
- PR #23 merged Playwright browser verification against the production build, real PostgreSQL, Mailpit, SMTP worker processing, private files, and cookie-backed sessions.
- The final exact-head PR #23 run `30429920983`, job `90504549396`, passed the complete owner/viewer browser workflow plus every existing unit, PostgreSQL, build, Compose, Docker-image, runtime-readiness, and protected-outbox gate.
- PR #23 merged as `d1627ca55ca4563f9588a60cff96889bda6f365a`.

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

## Verified browser slice merged through PR #23

- Added Playwright 1.61.1 with a reproducible npm lock and one Chromium worker.
- Added clean CI PostgreSQL and Mailpit services plus production-server and email-worker orchestration.
- Verified anonymous Account Hub denial, owner sign-up, tenant/business onboarding, party and catalog creation, and private upload/download.
- Verified invitation enqueueing, worker delivery to Mailpit, viewer account creation, invitation acceptance, and correct Account Hub identity/role presentation.
- Verified viewer read access while management controls are absent and a direct authenticated write request returns `403`.
- Verified password-reset delivery, same-origin reset navigation, credential update, old-session revocation, and sign-in with the new password.
- Retained traces, screenshots, videos, and an HTML report only on browser failure.
- Fixed the real party-creation UI defect discovered by the browser: the form now retains its element before awaiting the request so reset/reload completes after successful creation.
- Preserved and passed all existing unit, PostgreSQL, build, Compose, Docker-image, runtime-readiness, and outbox-smoke gates.

## Remaining Phase 3 priorities

1. Add migration-drift protection and reconcile remaining critical manually enforced composite constraints with Prisma models.
2. Add a tenant-level access audit trail for invitation, membership, role, disable/reactivate, and acceptance events.
3. Re-run unit, PostgreSQL, browser, migration, runtime, and Docker verification from a clean branch.
4. Reassess Phase 3 from evidence before enabling Phase 4.

## Tracked non-blocking follow-up

- Pagination for capped party, catalog, file, and audit lists.
- Full contact/address editing and removal.
- Broader party/catalog/import audit coverage.
- File attachment target validation, stronger OOXML inspection, deployment request-size limits, and restore drills.
- Entitlement value-type constraints and subscription start/end-date enforcement.

## Active blockers

- Phase 4 remains blocked by migration-drift protection and tenant access-change auditing.
- No accounting transaction should be exposed until Phase 3 is explicitly re-verified and chart structure, periods, posting invariants, and reversal policy are implemented and integration-tested.
