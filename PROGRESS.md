# Progress

Last updated: July 29, 2026
Current branch: `main`
Current phase: Phase 4 — Accounting kernel: chart structure and account lifecycle

## Evidence-based verified state

- Phase 1 application foundation and Phase 2 identity/access foundations are merged and covered by the repository CI gate.
- Phase 3 shared ERP foundations are complete: business profile, parties and contacts, catalog and units, staged imports, private files, business audit storage, numbering, exports, typed custom fields, durable queued email, browser verification, migration integrity, and immutable tenant access history.
- Better Auth uses PostgreSQL-backed revocable sessions.
- Business access resolves through active tenant and business memberships plus an active tenant subscription.
- Private files remain outside the public web root and use authenticated no-store downloads.
- Controlled exports are scoped, spreadsheet-safe, bounded, checksummed, and audited without retaining generated payloads.
- PR #22 merged the independent transaction, authorization, lifecycle, setup, and deployment hardening corrections. Run `30427561733`, job `90497258414`, passed its complete gate.
- PR #23 merged production Playwright verification against PostgreSQL, Mailpit, the email worker, private storage, and cookie sessions. Run `30429920983`, job `90504549396`, passed its complete gate; merge `d1627ca55ca4563f9588a60cff96889bda6f365a`.
- PR #24 merged clean-install and base-to-head migration integrity protection. Run `30432096576`, job `90511416006`, passed schema, catalog, upgrade, application, browser, Docker, and runtime gates; merge `acd0c8eb48d110ed8995842ece3e263a84826af9`.
- PR #25 merged immutable tenant access history as `f13644c3d6248bf074647377b65910af8447ad9a`.
- The final exact-head PR #25 run `30440271034`, job `90537656256`, passed clean dependency installation, Prisma generation, all migrations, migration history/diff/catalog verification, real base-to-head upgrade preservation, lint, strict TypeScript, unit and PostgreSQL tests, production build, owner access-history Playwright verification, Compose validation, both Docker images, runtime boot, database readiness, and protected outbox smoke.

## Phase 3 completion

Phase 3 satisfies the repository completion rule. The blockers identified by `PHASE_3_VERIFICATION_AUDIT.md` were corrected through PRs #22–#25 and verified through clean executable gates.

The completed scope includes shared ERP master data, file/audit/numbering/export/custom-field/outbox foundations and their tenant, authorization, concurrency, migration, browser, and runtime safety boundaries. It does not imply that accounting, VAT, sales, purchases, banking, inventory, projects, industry workflows, PDFs, e-invoicing, or commercial SaaS functionality is complete.

## Active Phase 4 slice

1. Implement tenant/business-scoped chart structure and account lifecycle without transaction entry.
2. Define account classes, types, codes, names, normal balance, hierarchy, control-account rules, activation, and safe deactivation/archive behavior.
3. Add explicit UAE-oriented default chart templates as business setup data without journal balances or postings.
4. Add RBAC, feature entitlement, protected UI, audit events, tenant isolation, lifecycle, hierarchy, and migration-integrity tests.
5. Follow with accounting periods and locks.
6. Implement the central balanced posting kernel, idempotency, reversals, and PostgreSQL integration coverage before exposing journals or document posting.

## Tracked non-blocking follow-up

- Pagination for capped party, catalog, file, business-audit, and tenant-access history lists.
- Full contact/address editing and removal.
- Broader party/catalog/import audit coverage.
- File attachment target validation, stronger OOXML inspection, deployment request-size limits, and coordinated restore drills.
- Entitlement value-type constraints and subscription start/end-date enforcement.

## Active blockers

- No remaining Phase 3 blocker.
- Phase 4 transaction entry remains blocked until chart structure, periods/locks, balanced posting invariants, idempotency, and reversal policy are implemented and PostgreSQL integration-tested.