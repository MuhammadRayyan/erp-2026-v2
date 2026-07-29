# Tenant Access Audit

Tenant access history is an append-only tenant-scoped record of changes that affect who can enter a tenant or business and what role they hold.

## Recorded events

The audit records:

- invitation creation, supersession, revocation, expiry, and acceptance;
- tenant-member activation and disablement;
- business access grants, role/status updates, and disablement;
- administration-driven session revocation with the number of deleted sessions.

Events are written inside the same PostgreSQL transaction as the access change. A failed transaction therefore cannot leave a misleading audit entry, and a committed access change cannot omit its required event.

## Authorization

Only an active tenant owner with the `users.manage` entitlement may open tenant access administration or read its history. Operational business roles cannot read tenant-wide access events.

Invitation acceptance is a self-service transition. The accepting user is therefore both actor and target for the membership, business-access, and acceptance events created by that transaction.

## Immutability

`TenantAccessEvent` is append-only:

- application services expose creation and reading only;
- a PostgreSQL trigger rejects every `UPDATE` and `DELETE`;
- tenant and optional business scope are enforced by foreign keys;
- CI verifies the table checks, composite business key, trigger, and function through the migration-integrity manifest.

Corrections must be represented by a later access operation and a new event. Existing history is never rewritten.

## Safe metadata

Events may retain identifiers, role/status changes, expiry timestamps, sources, and counts needed to explain an access decision. The audit helper normalizes metadata to JSON and rejects:

- keys containing `password`, `secret`, `token`, or `url`;
- HTTP or HTTPS URL values;
- values that cannot be represented safely as JSON.

Invitation tokens, token digests, reset links, passwords, SMTP credentials, sessions, and email message bodies must never be copied into access history.

## No-op and concurrency rules

- Requests that do not change membership or business-access state create no event.
- Invitation creation is serialized by the tenant row lock already used for user-capacity enforcement.
- Invitation acceptance and revocation lock the invitation row before evaluating state.
- Bulk expiry uses one conditional `UPDATE ... RETURNING`, so concurrent administration refreshes cannot create duplicate expiry events.
- Disabling a tenant member disables active business grants and revokes sessions in the same transaction; contradictory requests that simultaneously activate a grant are rejected.

## Owner interface

The tenant users-and-access page shows the latest 100 events with:

- event type and summary;
- target user/email;
- actor or `System`;
- optional business;
- safe role/status/session-count details;
- immutable occurrence timestamp.

The fixed cap is intentional for the current small-team deployment. Pagination remains a non-blocking future improvement.

## Verification

PostgreSQL integration tests cover lifecycle completeness, tenant isolation, owner-only reads, no-op suppression, exact session counts, unsafe metadata rejection, cross-tenant business rejection, and database update/delete denial.

Playwright verifies that the owner sees accepted-invitation and business-access events through the production tenant administration page after a real Mailpit-delivered invitation is accepted.