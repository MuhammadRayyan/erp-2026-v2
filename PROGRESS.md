# Progress

Last updated: July 29, 2026
Current branch: `phase-4-accounting-periods`
Current phase: Phase 4 — Accounting kernel
Current slice: Accounting periods and locks — verified complete

## Evidence-based verified state

- Phases 1–3 are complete and merged through PR #25.
- PR #26 merged normally into `main` as `87782734a3ee32d8edf0d0e6353a5e40dc87ae5c`.
- The chart-of-accounts foundation is complete and merged.
- PR #27 implements business-scoped accounting periods and date locks without exposing financial transaction entry.
- Implementation-head run `30465222027`, job `90621155313`, passed clean dependency installation, Prisma generation, forward migrations, migration status, supported schema diff, PostgreSQL catalog integrity, real base-to-head upgrade verification, lint, strict TypeScript, unit tests, PostgreSQL integration tests, production build, Playwright browser verification, Compose validation, migration/runtime image builds, booted runtime readiness, and protected outbox smoke.
- Better Auth uses PostgreSQL-backed revocable sessions.
- Business access requires active tenant/business memberships and an active subscription.
- Shared master data, files, audit, numbering, exports, custom fields, queued email, browser E2E, migration integrity, and immutable tenant access history remain covered by the repository gate.
- No balances, journals, document postings, VAT postings, allocations, reconciliation, or financial statements are exposed.

## Verified accounting structure

- `LedgerAccount` is tenant/business scoped and separate from Better Auth's `Account` model.
- Asset, liability, equity, revenue, and expense classes use constrained account types and debit/credit normal balances.
- Header, posting, and control kinds enforce manual-posting restrictions.
- Required system controls remain active and system structure is immutable.
- Composite scope, hierarchy, lifecycle, cycle, class/type/balance/kind, and active-parent rules are enforced by PostgreSQL and the application service.
- Existing businesses receive a deterministic UAE-oriented chart through migration; newly onboarded businesses receive the same chart atomically.
- Owners and accountants may manage accounts; viewers remain read-only.
- Account creation, update, activation, and deactivation create business audit events.

## Verified accounting-period boundary

- Periods are tenant/business scoped and use `OPEN`, `SOFT_LOCKED`, or `CLOSED` states.
- PostgreSQL prevents overlap, cross-fiscal-year ranges, unsafe transitions, deletion, and date edits after locking.
- A business-level advisory transaction lock serializes period creation and fiscal-year-setting changes.
- Lock, close, and reopen transitions require a persisted reason and timestamp.
- Owners and accountants may manage periods; viewers remain read-only.
- Period creation, edits, and transitions create business audit events.
- The reusable posting-date guard requires a covering open period and rejects missing, soft-locked, or closed dates inside the caller's transaction.
- Changing the fiscal-year start month is rejected after periods exist.

## Current Phase 4 priority

Implement one central balanced and idempotent posting kernel before exposing any journal or document transaction entry.

The next slice must provide:

1. immutable posted journal headers and lines with exact decimal amounts;
2. enforced debit-equals-credit balance inside one transaction;
3. tenant/business scope and active posting-account validation;
4. control-account and manual-posting policy enforcement;
5. accounting-period validation inside the posting transaction;
6. stable source type/source ID/idempotency uniqueness;
7. linked reversal and correction lineage without destructive mutation;
8. atomic audit and future outbox integration;
9. PostgreSQL constraints, migration-integrity protection, unit tests, integration tests, concurrency/retry tests, browser-safe boundaries, Docker/runtime evidence, and updated operating documentation.

## Explicitly not implemented

- Opening balances.
- Manual journal-entry UI.
- Sales, purchase, bank, inventory, payroll, or project posting.
- VAT calculation or returns.
- Receivable/payable allocation.
- Bank reconciliation.
- Trial balance, general ledger, profit and loss, or balance sheet reports.
- Period-closing and retained-earnings transfer.

## Tracked non-blocking follow-up

- Pagination for capped registers.
- Dynamic filtering of account-type choices by selected class in the client form; server validation already enforces compatibility.
- Full contact/address editing and removal.
- Broader party/catalog/import audit coverage.
- File attachment target validation, stronger OOXML inspection, deployment request-size limits, and coordinated restore drills.
- Entitlement value-type constraints and subscription start/end-date enforcement.

## Active blockers

- Accounting transaction entry remains blocked until the balanced posting kernel, source idempotency, account/period enforcement, and linked reversal policy pass the complete repository gate.
