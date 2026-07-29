# Progress

Last updated: July 29, 2026
Current branch: `phase-4-accounting-periods`
Current phase: Phase 4 — Accounting kernel
Current slice: Accounting periods and locks

## Evidence-based verified state

- Phases 1–3 are complete and merged through PR #25.
- PR #26 merged normally into `main` as `87782734a3ee32d8edf0d0e6353a5e40dc87ae5c`.
- Better Auth uses PostgreSQL-backed revocable sessions.
- Business access requires active tenant/business memberships and an active subscription.
- Shared master data, files, audit, numbering, exports, custom fields, queued email, browser E2E, migration integrity, and immutable tenant access history remain covered by the repository gate.
- The chart-of-accounts slice is complete: business-scoped account structure, hierarchy, lifecycle, UAE-oriented defaults, accounting RBAC, entitlement enforcement, audit events, PostgreSQL constraints, browser verification, and migration-upgrade evidence are merged.
- No financial transaction entry is exposed.

## Verified chart-of-accounts boundary

- `LedgerAccount` is tenant/business scoped and separate from Better Auth's `Account` model.
- Asset, liability, equity, revenue, and expense classes use constrained account types and debit/credit normal balances.
- Header, posting, and control kinds enforce manual-posting restrictions.
- Required system controls remain active and system structure is immutable.
- Composite scope, hierarchy, lifecycle, cycle, class/type/balance/kind, and active-parent rules are enforced by PostgreSQL and the application service.
- Existing businesses receive a deterministic UAE-oriented chart through migration; newly onboarded businesses receive the same chart atomically.
- Owners and accountants may manage accounts; viewers remain read-only.
- Account creation, update, activation, and deactivation create business audit events.

## Current Phase 4 objective

Implement business-scoped accounting periods and date locks before any journal or document posting is exposed.

The slice must provide:

1. open, soft-locked, and closed period states;
2. non-overlapping business periods;
3. date ranges contained within one configured fiscal year;
4. explicit reason metadata for lock, close, and reopen transitions;
5. locked and audited edits/status changes;
6. owner/accountant management with viewer read-only access;
7. a reusable posting-date guard for the later central journal kernel;
8. PostgreSQL constraints/triggers, migration-integrity protection, unit tests, integration tests, browser verification, Docker/runtime evidence, and updated operating documentation.

## Explicitly not implemented

- Opening balances.
- Journal entries or lines.
- Posted balances or general ledger.
- Document posting.
- VAT calculation/returns.
- Receivable/payable allocation.
- Bank reconciliation.
- Financial statements.
- Closing and retained-earnings transfer.
- Reversal or correction journals.

## Next Phase 4 sequence

1. Complete and verify accounting periods and locks.
2. Implement one central balanced posting kernel with source idempotency, period enforcement, and linked reversals.
3. Add PostgreSQL integration tests for balance, scope, lock, retry, correction, and reversal invariants.
4. Keep journal and document transaction entry hidden until those invariants pass the complete repository gate.

## Tracked non-blocking follow-up

- Pagination for capped registers.
- Dynamic filtering of account-type choices by selected class in the client form; server validation already enforces compatibility.
- Full contact/address editing and removal.
- Broader party/catalog/import audit coverage.
- File attachment target validation, stronger OOXML inspection, deployment request-size limits, and coordinated restore drills.
- Entitlement value-type constraints and subscription start/end-date enforcement.

## Active blockers

- Accounting periods and locks are not yet implemented.
- Accounting transaction entry remains blocked by periods/locks, the balanced posting kernel, source idempotency, and reversal policy.
