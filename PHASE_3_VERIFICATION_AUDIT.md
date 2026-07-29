# Phase 3 Verification Audit

Audit date: July 29, 2026
Audit basis: repository code, Prisma models, committed migrations, PostgreSQL catalogs, clean-install and base-to-head upgrade databases, API and server use cases, unit tests, PostgreSQL integration tests, Playwright browser workflows, Docker configuration, Git history, and executable GitHub Actions evidence. `PROGRESS.md` and `CHANGELOG.md` are claims to verify, not evidence by themselves.

## Current conclusion

Phase 3 contains substantial working foundations. The confirmed transaction, authorization, lifecycle, setup, numbering, browser-integration, and migration-integrity defects or gaps found during this audit have been corrected through merged PRs #22–#24 and covered by regression, browser, clean-install, catalog, or upgrade verification. Browser E2E and migration-drift protection are no longer blockers. Phase 3 remains open only because complete tenant access-change auditing is still missing. Phase 4 accounting remains blocked until that final gate and a complete Phase 3 reassessment.

## Verified strengths

- Better Auth uses PostgreSQL-backed revocable sessions.
- Business access resolves through active tenant and business memberships and an active subscription.
- Operational records use tenant/business-scoped queries and composite PostgreSQL foreign keys.
- Parties, catalog, custom fields, files, numbering, exports, and email outbox have PostgreSQL integration coverage.
- Private file objects remain outside the public web root and downloads are authenticated and non-cacheable.
- Catalog imports use persisted preview rows, explicit decisions, locked commit transactions, unit locks, and target-version checks.
- Number allocations and settings updates use the same sequence lock and preserve immutable, non-reusable history.
- Controlled exports are permission-scoped, spreadsheet-safe, bounded, and audited without retaining payloads.
- Custom fields use typed values plus database target validation.
- Email work is durable, concurrently claimed, retried with bounded backoff, correlated with current invitation state, and scrubbed after terminal outcomes.
- A production build and separate worker complete the critical browser workflow against real PostgreSQL, Mailpit, SMTP, private storage, and cookie sessions.
- The runtime image boots against PostgreSQL and passes database readiness and protected outbox smoke checks.
- Clean migration replay, Prisma-supported schema drift, PostgreSQL-specific invariants, base-to-head upgrade, and representative-data preservation are enforced in CI.

## Corrected during this audit

### Tenant access and invitations

- Protected `business.owner` invitation grants are rejected by the service and rechecked during acceptance.
- Expired invitation and outbox states commit before `INVITATION_EXPIRED` is returned.
- Tenant administration services consistently enforce `users.manage`.
- Invitation grants are bound to the invitation tenant through a composite Prisma relation and PostgreSQL foreign key.
- Pending invitations normalize expiry before administration display.
- Claimed invitation messages recheck actionable state before SMTP delivery.

### Catalog lifecycle and imports

- Item edits and lifecycle changes lock the item row.
- Reactivation locks and validates the referenced unit.
- Import row decisions cannot race final commit.
- Update rows reject targets changed after preview.

### Numbering

- Settings updates and allocations lock the same sequence row.
- Reset policy and start value become immutable after first allocation.
- Reused idempotency keys must match the original date and reference.
- Voids lock the allocation and produce one transition/audit event.

### Delivery, setup, and deployment

- Changed email payloads cannot reuse an idempotency key.
- New password-reset requests cancel older queued resets.
- Module phase metadata matches the roadmap and is unit-tested.
- Host setup starts the email worker and documents outbox settings.
- PostgreSQL and Mailpit are loopback-bound.
- The worker waits for database-aware readiness.
- Sensitive business-profile changes create audit events.

### Browser integration

- Playwright runs one stateful Chromium workflow against the production build and clean PostgreSQL/Mailpit services.
- The scenario proves anonymous denial, sign-up, onboarding, party/catalog creation, private upload/download, invitation delivery/acceptance, viewer read-only enforcement, password reset, session revocation, and reauthentication.
- Viewer authorization is checked through both UI absence and a direct authenticated `403` write denial.
- Private downloads are byte-verified for owner and viewer contexts.
- Invitation/reset links stay on the configured origin and tokens are not logged.
- Failure evidence retains short-lived traces, screenshots, videos, and an HTML report.
- The browser gate found and verified the fix for `PartyCreateForm` losing `event.currentTarget` after an asynchronous request.
- Stateful security workflows run once per clean job so legitimate rate limits do not hide the primary failure.

### Migration integrity

- Supported live foreign keys and stable database names are represented in the multi-file Prisma schema.
- Existing SQL names use Prisma `map:` metadata, preventing duplicate simpler keys or unintended renames.
- The party trigram GIN/operator-class index is represented in Prisma.
- Clean CI requires migration-history status and an empty Prisma schema-to-database diff.
- A fail-closed PostgreSQL catalog manifest verifies 26 critical composite foreign keys, 34 check constraints, the trigram and two partial unique indexes, the custom-field trigger/function pair, and `pg_trgm`.
- Pull requests create a second database from the exact base commit, seed user/owner/tenant/business/unit/party records, apply the head migrations, then re-run status, diff, catalog, and data-preservation checks.
- The initial diagnostic step and inventory-only script were removed after the permanent gate replaced them.

## Executable evidence

- PR #22 run `30427561733`, job `90497258414`, passed hardening regression, production, Docker, and runtime gates. PR #22 merged as `da1e313244fff647c25ca7aedd1ff7a6f78a54e7`.
- PR #23 run `30429920983`, job `90504549396`, passed the complete production browser workflow while repeating all prior gates. PR #23 merged as `d1627ca55ca4563f9588a60cff96889bda6f365a`.
- PR #24 run `30432096576`, job `90511416006`, passed clean migration status, empty supported-object schema diff, PostgreSQL catalog integrity, base-to-head upgrade preservation, lint, strict TypeScript, unit tests, 60 PostgreSQL integration tests, production build, Playwright E2E, Compose validation, migration/runtime image builds, runtime boot, readiness, and protected outbox smoke. PR #24 merged as `acd0c8eb48d110ed8995842ece3e263a84826af9`.

This evidence does not replace coordinated restoration drills.

## Remaining Phase 3 blocker

**Tenant access audit trail:** invitation creation, supersession, revocation, expiry and acceptance; member disable/reactivate; business-role changes; and administration-driven session revocation need coherent immutable tenant-level events and a protected owner-readable history. The current business-scoped audit model cannot fully represent these changes.

## Tracked non-blocking gaps

- Party, catalog, file, and audit registers use fixed caps instead of pagination.
- Contacts and addresses cannot yet be fully edited or removed.
- Party/catalog/import changes are not comprehensively audited.
- File attachments accept arbitrary entity identifiers.
- OOXML validation checks ZIP signatures rather than internal structure.
- Multipart uploads are buffered before application-level size validation; deployment request limits remain required.
- Entitlement value-type constraints and subscription date enforcement remain incomplete.
- Full coordinated restore drills remain operational work.

## Best next sequence

1. Add tenant-level access events and protected owner-readable history.
2. Re-run the complete migration, unit, PostgreSQL, browser, Docker, and runtime gate from a clean branch.
3. Reassess Phase 3 from evidence. Only then begin Phase 4 with chart structure and account lifecycle, followed by periods/locks and the central balanced posting kernel.
