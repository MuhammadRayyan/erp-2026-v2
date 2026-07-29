# Progress

Last updated: July 29, 2026
Current branch: `phase-3-hardening-audit`
Current phase: Phase 3 — Verification and hardening

## Evidence-based verified state

- Phase 1 application foundation and Phase 2 identity/access foundations are merged and covered by the repository CI gate.
- Phase 3 working foundations are merged through PRs #10–#21: business profile, parties and contacts, catalog and units, staged catalog imports, private files, audit storage, numbering, exports, custom fields, and durable queued email.
- The clean PR #21 head passed `npm ci`, Prisma generation, migration deployment, lint, type checking, 19 unit tests, 52 PostgreSQL integration tests, production build, Compose validation, and migration/runtime Docker image builds.
- Better Auth uses PostgreSQL-backed revocable sessions.
- Business access resolves through active tenant and business memberships and an active subscription.
- Private files are stored outside the public web root and downloaded through authenticated no-store routes.
- Catalog import commit, number allocation, custom-field value replacement, and email outbox claiming use explicit PostgreSQL transactions or locks.
- Controlled exports are scoped, spreadsheet-safe, bounded, and audited without retaining generated payloads.

## Audit correction

The prior declaration that Phase 3 was complete was premature. A repository-level audit found confirmed defects in invitation lifecycle and protected-role enforcement, inconsistent tenant entitlement gates, catalog activation/unit integrity, numbering settings concurrency and idempotency, import row-resolution concurrency, module phase metadata, local worker setup, and deployment exposure. Browser E2E and full-stack smoke verification are also absent despite the project baseline requiring them.

The detailed evidence and remaining gaps are recorded in `PHASE_3_VERIFICATION_AUDIT.md`.

## Current hardening slice

1. Correct tenant invitation lifecycle, protected-role rules, database scope, and service-level entitlement enforcement.
2. Correct catalog item activation so inactive units cannot be referenced or raced.
3. Lock numbering settings against allocation, define immutable post-allocation settings, validate idempotency reuse, and serialize voids.
4. Lock import row decisions against finalization and prevent stale target overwrites.
5. Reconcile module phases, README, changelog, decisions, security guidance, and worker instructions with actual code.
6. Bind local-only infrastructure ports safely and add readiness/full-stack verification where practical.
7. Add regression tests and require the complete CI/Docker gate before declaring Phase 3 complete again.

## Next plan after hardening

1. Add browser E2E coverage for authentication, onboarding, authorization, parties, catalog, files, invitations, and queued email.
2. Add full-stack Compose smoke verification and a migration-drift safeguard for manually enforced composite constraints.
3. Close remaining explicitly tracked master-data usability gaps such as pagination and related-record editing.
4. Reassess Phase 3 with evidence from the corrected branch.
5. Begin Phase 4 only after that gate, starting with chart-of-accounts structure, then accounting periods and locks, then the balanced journal kernel.

## Active blockers

- Phase 4 is blocked until the confirmed Phase 3 defects and verification gaps above are corrected or explicitly accepted as deferred with safe boundaries.
