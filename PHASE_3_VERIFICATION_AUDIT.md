# Phase 3 Verification Audit

Audit date: July 29, 2026
Audit basis: repository code, Prisma models, committed migrations, API and server use cases, tests, Docker configuration, Git history, and the clean PR #21 CI run. `PROGRESS.md` and `CHANGELOG.md` were treated as claims to verify, not as evidence by themselves.

## Current conclusion

Phase 3 contains substantial working foundations, but it must remain in verification and hardening until the confirmed defects below are corrected and the missing runtime/browser checks are added. Phase 4 accounting implementation must not depend on unresolved numbering, access-control, lifecycle, migration, or deployment assumptions.

## Verified strengths

- Better Auth uses PostgreSQL-backed revocable sessions.
- Business access resolves through active tenant and business memberships and an active subscription.
- Most operational records use tenant/business-scoped queries and composite PostgreSQL foreign keys.
- Parties, catalog, custom fields, files, numbering, exports, and email outbox have PostgreSQL integration coverage.
- Private file objects remain outside the public web root and downloads are authenticated and non-cacheable.
- Catalog imports use persisted preview rows, explicit decisions, a locked commit transaction, and unit locks.
- Number allocation uses a sequence-row lock, explicit dates, stored formatted values, and non-reusable void history.
- CSV exports enforce source-module visibility, neutralize spreadsheet formulas, cap synchronous results, and retain only run metadata.
- Custom-field values use typed columns and database target validation.
- Email work is durable, claimed with `FOR UPDATE SKIP LOCKED`, retried with bounded backoff, and scrubbed after terminal outcomes.
- The clean PR #21 pipeline passed dependency installation, Prisma generation, migration deployment, lint, type checking, 19 unit tests, 52 PostgreSQL integration tests, production build, Compose validation, and both Docker image builds.

## Confirmed blocking defects

### Tenant access and invitations

- The invitation service accepts the protected `business.owner` role when called outside the UI.
- The expired-invitation branch updates status and then throws inside the same transaction, rolling its own update back.
- Tenant user-management entitlement enforcement is not consistently located in the service boundary; listing, member changes, and revocation can bypass the intended feature gate through direct server calls.
- `BusinessInvitationGrant` is not database-bound to the tenant of its invitation through one composite foreign key.
- A message already claimed as `PROCESSING` may still send after the related invitation is superseded, accepted, revoked, or expired.

### Catalog lifecycle

- Reactivating a catalog item does not lock or verify that its unit is active, allowing an active item to reference an inactive unit and race with unit deactivation.

### Numbering

- Sequence settings updates do not lock the sequence row and can race the first allocation, potentially restoring an obsolete `nextValue`.
- Reset policy and start-value changes after allocations have no safe transition rule and can unexpectedly restart numbering.
- Reusing an idempotency key with a different effective date or reference silently returns the old allocation instead of reporting a conflict.
- Concurrent void requests can create duplicate void audit events.

### Catalog imports

- Row-resolution updates do not lock the import batch and can race final commit.
- Resolved update rows have no optimistic check against source records changed after preview.

### Deployment and documentation

- The live module registry phase numbers do not match `MODULES_AND_PHASES.md`.
- `README.md` still reports Phase 3, omits the outbox worker and its environment variables, and does not start the worker in the recommended host-development flow.
- PostgreSQL and Mailpit ports bind to all host interfaces even though the security plan says internal services must not be publicly exposed.
- The latest Phase 4 activation was a documentation-only commit and did not itself run CI.

## Verified gaps that must be tracked

- There is no browser E2E suite despite the implementation baseline and AI workflow requiring business-workflow E2E verification.
- CI validates Compose syntax and image builds but does not boot the full stack and prove web, worker, SMTP, database, and private storage together.
- The health endpoint is liveness-only and does not verify database readiness.
- Audit storage exists, but business-profile changes, party/catalog changes, imports, invitations, and member-role changes are not consistently audited.
- Party, catalog, file, and audit lists use fixed row caps rather than pagination.
- Contacts and addresses can be added and selected but not fully edited or removed.
- File attachments accept arbitrary entity identifiers without target validation; OOXML validation currently checks ZIP magic rather than document structure.
- The upload route buffers multipart files before applying the configured application size limit.
- Entitlement records are not database-constrained by feature value type, and subscription start/end dates are not resolved.
- Several manually added composite PostgreSQL constraints are not represented as Prisma relations. A future migration-drift check must prove that normal schema evolution preserves them.

## Hardening gate before Phase 4

1. Correct all confirmed blocking defects and add regression tests.
2. Reconcile the module registry, README, progress, changelog, decisions, and operations guidance with actual behavior.
3. Add browser E2E and full-stack smoke verification for authentication, onboarding, authorization, master data, files, queued email, and restoration-sensitive paths.
4. Add a migration-drift check or explicitly model every critical composite relation in Prisma.
5. Re-run the complete CI and Docker gate from a clean branch.
6. Only then begin accounting with chart structure and account lifecycle, followed by periods and locks, then the central balanced posting kernel.
