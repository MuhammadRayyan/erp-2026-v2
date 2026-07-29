# Accounting Periods and Locks

This guide defines the Phase 4 accounting-period boundary. Periods control the accounting dates accepted by the central posting kernel. The repository still does not expose ordinary manual journals, opening-balance entry, document posting, allocations, VAT posting, reconciliation, or financial statements.

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

An open period allows the posting kernel to accept accounting dates inside the period, subject to journal, account, authorization, idempotency, currency, source, and module-policy rules.

Names and dates may be edited while a period is open. Edits remain subject to overlap and fiscal-year validation.

### Soft locked

A soft-locked period blocks ordinary posting. It represents a review or month-end preparation state.

The posting-date guard rejects soft-locked dates. A later override workflow may be added only with an explicit stronger capability, reason, audit evidence, and module-specific policy; this repository does not provide an override.

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

The posting kernel calls the period guard inside a Serializable transaction. A concurrent period transition and posting cannot both commit in a way that leaves the journal posted against a non-open final period state.

## Authorization and entitlement

- `accounting.view` reads periods.
- `accounting.manage` creates, edits, locks, closes, and reopens periods.
- `accounting.core` must be enabled for the tenant.
- Business owners, administrators, and accountants may manage periods through their current role definitions.
- Viewer roles remain read-only.

Every create, update, lock, close, and reopen action creates a business audit event inside the same transaction as the state change.

## Posting-kernel contract

`assertAccountingDateOpen` is the authoritative reusable date guard.

It requires exactly one period covering the requested accounting date and rejects:

- dates with no configured period;
- soft-locked periods;
- closed periods.

The journal kernel calls this guard inside the same transaction that locks source and idempotency identities, validates accounts and currency, creates the journal and lines, finalizes the journal, and writes audit evidence. Calling it before a transaction or only in the browser would not protect against concurrent lock or close actions.

Opening balances and every future document/subledger posting workflow must use the same guard through the central kernel.

## Migration and verification

The forward migration introduces the period enum, table, composite scope, checks, indexes, and validation trigger/function. The repository integrity gate separately verifies these PostgreSQL objects in addition to the general manifest and the focused journal verifier.

Automated coverage includes:

- date contract validation;
- calendar and non-calendar fiscal-year calculations;
- create, edit, list, lock, close, reopen, and audit behavior;
- overlapping and fiscal-year-crossing rejection;
- concurrent overlapping creation;
- invalid transition and direct-delete rejection;
- posting-date guard behavior for missing, open, soft-locked, and closed dates;
- central journal rejection against soft-locked and closed periods;
- tenant isolation, RBAC, and entitlement denial;
- fiscal-year setting lock after period creation;
- browser creation and status transitions;
- clean migration, base-to-head upgrade, Docker, and runtime gates.

## Explicitly not implemented

- opening balances;
- ordinary manual journal-entry UI or public write route;
- posting override authority for soft-locked periods;
- closing checklist or retained-earnings transfer;
- subledger closing;
- VAT-period submission locks;
- financial statements;
- foreign-currency revaluation.

The central balanced posting kernel is implemented and verified. The next Phase 4 slice is controlled opening balances plus read-only journal/general-ledger evidence, while ordinary transaction entry remains blocked.
