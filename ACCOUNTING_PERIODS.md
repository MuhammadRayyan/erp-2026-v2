# Accounting Periods and Locks

This guide defines the Phase 4 accounting-period boundary. Periods control the accounting dates that the future balanced posting kernel may accept. This slice does not create journals, balances, opening entries, document postings, allocations, tax postings, or financial statements.

## Scope

Each business owns accounting periods containing:

- a clear name;
- inclusive start and end dates;
- open, soft-locked, or closed status;
- the latest status-change reason and time;
- business-scoped audit history.

Periods belong to exactly one tenant and business. They cannot overlap within a business and must remain inside one fiscal year based on the business profile's configured fiscal-year start month.

## Status meanings

### Open

An open period allows the future posting kernel to accept accounting dates inside the period, subject to all other journal, account, authorization, idempotency, and document rules.

Names and dates may be edited while a period is open. Edits remain subject to overlap and fiscal-year validation.

### Soft locked

A soft-locked period blocks ordinary posting. It represents a review or month-end preparation state.

The current posting-date guard rejects soft-locked dates. A later override workflow may be added only with an explicit stronger capability, reason, and audit evidence; this slice does not provide an override.

Dates cannot be changed while soft locked.

### Closed

A closed period rejects posting. Closing requires a reason and records audit evidence.

A period may be reopened only by a user with accounting-management authority and a reason. Reopening does not delete or rewrite the prior close event.

Dates cannot be changed while closed.

## Allowed transitions

- Open to soft locked
- Open to closed
- Soft locked to open
- Soft locked to closed
- Closed to open

Every transition requires a reason. No-op transitions create no new event.

## Fiscal-year boundary

A period must be wholly contained in one fiscal year. The fiscal year is derived from `BusinessProfile.fiscalYearStartMonth`.

Examples:

- A January-start business may create a period from January 1 through December 31 of the same year.
- An April-start business may create a period from April 1 through March 31 of the following year.
- A period may be shorter than a month or year when the business requires it, but it still cannot overlap another period or cross the fiscal-year boundary.

After the first accounting period is created, the fiscal-year start month cannot be changed through normal business settings. Changing it would invalidate established period coverage and requires a future controlled accounting migration rather than an ordinary profile edit.

## Concurrency and database protection

PostgreSQL and the application boundary enforce:

- composite tenant/business ownership;
- start date on or before end date;
- non-overlap under concurrent creation or edits;
- one-fiscal-year containment;
- valid status metadata;
- valid status transitions;
- date immutability after a period leaves open status;
- deletion prohibition.

Period writes and fiscal-year configuration changes use the same tenant/business advisory transaction lock. Row-level locks serialize edits and status changes to an existing period.

## Authorization and entitlement

- `accounting.view` reads periods.
- `accounting.manage` creates, edits, locks, closes, and reopens periods.
- `accounting.core` must be enabled for the tenant.
- Business owners, administrators, and accountants may manage periods through their current role definitions.
- Viewer roles remain read-only.

Every create, update, lock, close, and reopen action creates a business audit event inside the same transaction as the state change.

## Posting-kernel contract

`assertAccountingDateOpen` is the authoritative reusable date guard for the next Phase 4 slice.

It requires exactly one period covering the requested accounting date and rejects:

- dates with no configured period;
- soft-locked periods;
- closed periods.

The future journal kernel must call this guard inside the same transaction that writes the journal and its source/idempotency records. Calling it before a transaction or only in the browser would not protect against concurrent lock or close actions.

## Migration and verification

The forward migration introduces the period enum, table, composite scope, checks, indexes, and validation trigger/function. The repository integrity gate separately verifies these PostgreSQL objects in addition to the general manifest.

Automated coverage includes:

- date contract validation;
- calendar and non-calendar fiscal-year calculations;
- create, edit, list, lock, close, reopen, and audit behavior;
- overlapping and fiscal-year-crossing rejection;
- concurrent overlapping creation;
- invalid transition and direct-delete rejection;
- posting-date guard behavior for missing, open, soft-locked, and closed dates;
- tenant isolation, RBAC, and entitlement denial;
- fiscal-year setting lock after period creation;
- browser creation and status transitions;
- clean migration, base-to-head upgrade, Docker, and runtime gates.

## Explicitly not implemented

- accounting transactions;
- opening balances;
- journal entries and lines;
- posting override authority for soft-locked periods;
- closing checklist or retained-earnings transfer;
- subledger closing;
- VAT-period submission locks;
- financial statements;
- reversal and correction journals.

The next Phase 4 slice is one central balanced, idempotent posting kernel with source uniqueness, active-account validation, period enforcement, and linked reversals.
