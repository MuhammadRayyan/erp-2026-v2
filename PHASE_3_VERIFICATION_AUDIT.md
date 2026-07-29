# Phase 3 Verification Audit

Audit date: July 29, 2026
Audit basis: repository code, Prisma models, committed migrations, API and server use cases, tests, Docker configuration, Git history, and executable GitHub Actions evidence. `PROGRESS.md` and `CHANGELOG.md` were treated as claims to verify, not as evidence by themselves.

## Current conclusion

Phase 3 contains substantial working foundations. The confirmed transaction, authorization, lifecycle, setup, and numbering defects found during this audit have been corrected on PR #22 and covered by regression tests. Phase 3 must nevertheless remain open because browser E2E, migration-drift protection, and complete tenant access-change auditing are still missing. Phase 4 accounting remains blocked.

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

## Executable evidence

The code-equivalent PR #22 run `30427351994`, job `90496608146`, passed:

- clean dependency installation;
- multi-file Prisma generation;
- all forward migrations on a clean PostgreSQL database;
- lint and strict TypeScript checking;
- unit tests;
- 60 PostgreSQL integration tests, including the new defect regressions;
- Next.js production build;
- Docker Compose validation;
- migration and runtime Docker image builds;
- runtime-container boot;
- database readiness response;
- authenticated internal outbox-processing smoke request.

This evidence improves on the earlier build-only gate, but it is not a substitute for browser E2E or restoration testing.

## Remaining Phase 3 blockers

1. **Browser E2E:** no browser suite currently proves sign-up, owner onboarding, access denial, party/catalog workflows, private upload/download, invitation acceptance, password reset, and queued delivery through public routes.
2. **Migration drift protection:** several critical composite constraints were added with reviewed SQL. Remaining relations must be modeled where practical, and CI must detect when a future Prisma migration would remove or weaken them.
3. **Tenant access audit trail:** role changes, member disable/reactivate, invitation creation/revocation/acceptance, and entitlement-sensitive administration need a coherent tenant-level audit design. The current business-scoped audit model does not fully represent them.

## Tracked non-blocking gaps

- Party, catalog, file, and audit registers use fixed row caps instead of pagination.
- Contacts and addresses can be added and selected but not fully edited or removed.
- Party/catalog/import changes are not comprehensively audited.
- File attachments accept arbitrary entity identifiers without target validation.
- OOXML validation checks ZIP signatures rather than internal document structure.
- Multipart uploads are buffered before the configured application size check; deployment request limits are still required.
- Entitlement records are not database-constrained by feature value type, and subscription start/end dates are not yet resolved.
- Full restore drills and private-file write/download smoke checks remain operational tasks.

## Best next sequence

1. Merge the verified PR #22 hardening corrections without declaring Phase 3 complete.
2. Add Playwright browser E2E and a repeatable test seed covering authentication, onboarding, authorization, master data, files, invitations, password reset, and Mailpit delivery.
3. Add a migration-drift gate and reconcile remaining manually enforced composite constraints with Prisma models.
4. Add tenant-level access audit records and expose protected owner-readable history.
5. Re-run the complete unit, PostgreSQL, browser, runtime, Docker, and migration gate.
6. Reassess Phase 3 from evidence. Only then begin Phase 4 with chart structure and account lifecycle, followed by periods and locks, then the central balanced posting kernel.
