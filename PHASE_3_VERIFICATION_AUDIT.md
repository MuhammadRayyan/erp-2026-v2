# Phase 3 Verification Audit

Audit date: July 29, 2026
Audit basis: repository code, Prisma models, committed migrations, API and server use cases, unit tests, PostgreSQL integration tests, Playwright browser workflows, Docker configuration, Git history, and executable GitHub Actions evidence. `PROGRESS.md` and `CHANGELOG.md` are treated as claims to verify, not as evidence by themselves.

## Current conclusion

Phase 3 contains substantial working foundations. The confirmed transaction, authorization, lifecycle, setup, numbering, and browser-integration defects found during this audit have been corrected through PRs #22 and #23 and covered by regression or end-to-end verification. Browser E2E is no longer a blocker. Phase 3 must remain open because migration-drift protection and complete tenant access-change auditing are still missing. Phase 4 accounting remains blocked.

## Verified strengths

- Better Auth uses PostgreSQL-backed revocable sessions.
- Business access resolves through active tenant and business memberships and an active subscription.
- Most operational records use tenant/business-scoped queries and composite PostgreSQL foreign keys.
- Parties, catalog, custom fields, files, numbering, exports, and email outbox have PostgreSQL integration coverage.
- Private file objects remain outside the public web root and downloads are authenticated and non-cacheable.
- Catalog imports use persisted preview rows, explicit decisions, a locked commit transaction, unit locks, and target-version checks.
- Number allocation and settings updates use the same sequence-row lock; allocations preserve explicit dates, immutable formatted values, and non-reusable void history.
- CSV exports enforce source-module visibility, neutralize spreadsheet formulas, cap synchronous results, and retain only run metadata.
- Custom-field values use typed columns and database target validation.
- Email work is durable, claimed with `FOR UPDATE SKIP LOCKED`, retried with bounded backoff, correlated with current invitation state, and scrubbed after terminal outcomes.
- A production-built application and separate email worker have completed the critical browser workflow against real PostgreSQL, Mailpit, SMTP, private storage, and cookie-backed sessions.
- The built runtime image has been booted in CI against PostgreSQL; database-aware readiness and the protected outbox endpoint both succeeded.

## Corrected during this audit

### Tenant access and invitations

- Protected `business.owner` invitation grants are rejected by the service and rechecked during acceptance.
- Expired invitation and outbox states commit before `INVITATION_EXPIRED` is returned.
- Tenant administration services consistently enforce the `users.manage` entitlement.
- `BusinessInvitationGrant` is bound to its invitation tenant through a composite Prisma relation and PostgreSQL foreign key.
- Pending invitations are normalized for expiry before administration display.
- Claimed invitation messages recheck that the invitation is still pending and unexpired before SMTP delivery.

### Catalog lifecycle and imports

- Item edits and lifecycle changes lock the item row.
- Reactivation locks and validates the referenced unit, preventing active items from using inactive units or racing unit deactivation.
- Import row decisions lock the batch and cannot race final commit.
- Update rows snapshot the target version at preview and reject commit when the target changed afterward.

### Numbering

- Settings updates and allocations lock the same sequence row.
- Reset policy and start value are immutable after the first allocation.
- Reused idempotency keys must match the original effective date and reference.
- Allocation voids lock the allocation row and produce one state transition and one audit event.

### Delivery, setup, and deployment

- Changed email payloads cannot reuse an existing idempotency key.
- A new password-reset request cancels older pending/retry reset messages for the user.
- Module phase metadata matches the authoritative roadmap and is unit-tested.
- README host setup starts the email worker and documents all outbox settings.
- PostgreSQL and Mailpit host ports are loopback-only.
- The worker waits for database-aware web readiness.
- Sensitive business-profile and registration changes create audit events.

### Browser integration

- Playwright now runs the production build with one Chromium worker against clean PostgreSQL and Mailpit services.
- The critical scenario proves anonymous denial, owner sign-up, tenant/business onboarding, party and catalog creation, private upload/download, invitation delivery and acceptance, viewer read-only enforcement, password reset, old-session revocation, and sign-in with the new credential.
- Viewer authorization is checked through both rendered UI controls and a direct authenticated write request that must return `403`.
- Private file downloads are byte-verified from both owner and viewer browser contexts.
- Invitation and reset links are extracted from Mailpit without logging tokens and are accepted only when they remain on the configured application origin.
- Browser failure evidence retains short-lived traces, screenshots, videos, and an HTML report.
- The browser gate found a real `PartyCreateForm` defect: the API created the record, but the client accessed `event.currentTarget` after an asynchronous request and failed before reset/reload. The form now captures the element before awaiting, and the browser verifies the refreshed party register.
- Stateful authentication workflows run once per clean job rather than automatically retrying and triggering legitimate rate limits that obscure the original failure.

## Executable evidence

PR #22 run `30427561733`, job `90497258414`, passed:

- clean dependency installation;
- multi-file Prisma generation;
- all forward migrations on a clean PostgreSQL database;
- lint and strict TypeScript checking;
- unit tests;
- 60 PostgreSQL integration tests, including the hardening regressions;
- Next.js production build;
- Docker Compose validation;
- migration and runtime Docker image builds;
- runtime-container boot;
- database readiness response;
- authenticated internal outbox-processing smoke request.

The code-equivalent PR #23 run `30429567937`, job `90503417733`, additionally passed the complete Playwright workflow against the production build and real email worker, then repeated Compose validation, both image builds, runtime boot, readiness, and protected outbox smoke verification.

This evidence is not a substitute for migration-upgrade/drift verification or restoration testing.

## Remaining Phase 3 blockers

1. **Migration drift protection:** several critical composite constraints were added with reviewed SQL. Remaining relations must be modeled where practical, and CI must detect when a future Prisma migration would remove or weaken them.
2. **Tenant access audit trail:** role changes, member disable/reactivate, invitation creation/revocation/acceptance, and entitlement-sensitive administration need a coherent tenant-level audit design. The current business-scoped audit model does not fully represent them.

## Tracked non-blocking gaps

- Party, catalog, file, and audit registers use fixed row caps instead of pagination.
- Contacts and addresses can be added and selected but not fully edited or removed.
- Party/catalog/import changes are not comprehensively audited.
- File attachments accept arbitrary entity identifiers without target validation.
- OOXML validation checks ZIP signatures rather than internal document structure.
- Multipart uploads are buffered before the configured application size check; deployment request limits are still required.
- Entitlement records are not database-constrained by feature value type, and subscription start/end dates are not yet resolved.
- Full restore drills remain an operational task even though browser and runtime checks now verify private file write/download behavior.

## Best next sequence

1. Merge the verified PR #23 browser gate without declaring Phase 3 complete.
2. Add a migration-drift gate and reconcile remaining manually enforced composite constraints with Prisma models.
3. Add tenant-level access audit records and expose protected owner-readable history.
4. Re-run the complete unit, PostgreSQL, browser, migration, runtime, and Docker gate from a clean branch.
5. Reassess Phase 3 from evidence. Only then begin Phase 4 with chart structure and account lifecycle, followed by periods and locks, then the central balanced posting kernel.
