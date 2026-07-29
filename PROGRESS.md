# Progress

Last updated: July 29, 2026
Current branch: `phase-3-tenant-access-audit`
Current phase: Phase 3 — Shared ERP foundations, verified completion candidate

## Evidence-based verified state

- Phase 1 application foundation and Phase 2 identity/access foundations are merged and covered by the repository CI gate.
- Phase 3 foundations are implemented: business profile, parties and contacts, catalog and units, staged imports, private files, business audit storage, numbering, exports, typed custom fields, durable queued email, browser verification, migration integrity, and tenant access history.
- Better Auth uses PostgreSQL-backed revocable sessions.
- Business access resolves through active tenant and business memberships plus an active tenant subscription.
- Private files remain outside the public web root and use authenticated no-store downloads.
- Controlled exports are scoped, spreadsheet-safe, bounded, checksummed, and audited without retaining generated payloads.
- PR #22 merged the independent transaction, authorization, lifecycle, setup, and deployment hardening corrections. Run `30427561733`, job `90497258414`, passed its complete gate.
- PR #23 merged production Playwright verification against PostgreSQL, Mailpit, the email worker, private storage, and cookie sessions. Run `30429920983`, job `90504549396`, passed its complete gate; merge `d1627ca55ca4563f9588a60cff96889bda6f365a`.
- PR #24 merged clean-install and base-to-head migration integrity protection. Run `30432096576`, job `90511416006`, passed schema, catalog, upgrade, application, browser, Docker, and runtime gates; merge `acd0c8eb48d110ed8995842ece3e263a84826af9`.
- PR #25 implements the final tenant access-audit boundary and has passed the complete implementation-head gate in run `30439811046`, job `90536151781`.

## Tenant access audit verified in PR #25

- Added tenant-scoped typed events for invitation creation, supersession, revocation, expiry, and acceptance.
- Added member activation/disablement, business access grant/update/disablement, and administration-driven session-revocation events.
- Writes events inside the same transaction as the access change.
- Locks invitations for acceptance/revocation and uses conditional bulk expiry so concurrent actions do not duplicate lifecycle events.
- Suppresses events for no-op administration requests and rejects contradictory disable-plus-active-grant requests.
- Stores actor, target, optional business/invitation correlation, safe metadata, and immutable timestamps without tokens, URLs, passwords, sessions, or email bodies.
- PostgreSQL rejects every access-event update and delete.
- Tenant/business scope, event checks, and immutability trigger/function are covered by the migration-integrity manifest.
- The tenant administration page exposes the latest owner-readable access history after tenant-owner and `users.manage` authorization.
- PostgreSQL integration tests cover event completeness, owner-only reads, tenant isolation, session counts, no-op suppression, unsafe metadata, cross-tenant correlation, and database immutability.
- Playwright verifies accepted-invitation and business-access events through the real production owner interface.
- Serialized administration reads remove the PostgreSQL client concurrency warning previously observed in the browser process.

## Phase 3 completion assessment

The mandatory Phase 3 blockers identified by `PHASE_3_VERIFICATION_AUDIT.md` are now implemented and have executable evidence. Phase 3 can be marked complete after PR #25's synchronized documentation head passes the same full gate and the PR is merged normally.

This completion covers shared ERP foundations and their safety boundaries. It does not imply that accounting, VAT, sales, purchases, banking, inventory, projects, industry workflows, PDFs, e-invoicing, or commercial SaaS functionality is complete.

## Next implementation priority

1. Begin Phase 4 with tenant/business-scoped chart structure and account lifecycle.
2. Define account classes, account types, codes, names, normal balance, control-account rules, activation, and safe archival/deactivation behavior.
3. Add default UAE-oriented chart templates as explicit business setup data without posting transactions.
4. Follow with accounting periods and locks.
5. Implement the central balanced posting kernel, reversals, and integration coverage before exposing any accounting transaction workflow.

## Tracked non-blocking follow-up

- Pagination for capped party, catalog, file, business-audit, and tenant-access history lists.
- Full contact/address editing and removal.
- Broader party/catalog/import audit coverage.
- File attachment target validation, stronger OOXML inspection, deployment request-size limits, and coordinated restore drills.
- Entitlement value-type constraints and subscription start/end-date enforcement.

## Active blockers

- No remaining blocker for Phase 3 after the final exact-head verification and merge.
- Phase 4 transaction entry remains blocked until chart structure, periods/locks, balanced posting invariants, idempotency, and reversal policy are implemented and PostgreSQL integration-tested.