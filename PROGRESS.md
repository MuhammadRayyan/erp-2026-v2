# Progress

Last updated: July 29, 2026
Current branch: `phase-4-posting-kernel`
Current phase: Phase 4 — Accounting kernel
Current slice: Central balanced posting kernel — verified complete

## Evidence-based verified state

- Phases 1–3 are complete and merged through PR #25.
- PR #26 merged normally into `main` as `87782734a3ee32d8edf0d0e6353a5e40dc87ae5c`.
- PR #27 merged normally into `main` as `e4d8e7af1e8baad116dc7ef09d56800cf68d4544`.
- The chart-of-accounts and accounting-period foundations are complete and merged.
- PR #28 implements the internal central posting kernel without exposing manual journal or document transaction entry.
- Implementation-head run `30469369143`, job `90635303570`, passed clean dependency installation, Prisma generation, forward migrations, migration status, supported schema diff, PostgreSQL catalog integrity, real base-to-head upgrade verification, lint, strict TypeScript, unit tests, PostgreSQL integration tests, production build, Playwright browser verification, Compose validation, migration/runtime image builds, booted runtime readiness, and protected outbox smoke.
- Better Auth uses PostgreSQL-backed revocable sessions.
- Business access requires active tenant/business memberships and an active subscription.
- Shared master data, files, audit, numbering, exports, custom fields, queued email, browser E2E, migration integrity, and immutable tenant access history remain covered by the repository gate.
- No manual journal UI, opening-balance workflow, document posting, VAT posting, allocations, reconciliation, or financial statements are exposed.

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

## Verified posting-kernel boundary

- Journal headers and lines are tenant/business scoped and use exact four-decimal amounts.
- A journal exists as `PENDING` only inside its transaction and must become immutable `POSTED` history before commit.
- The application and PostgreSQL independently enforce at least two lines, positive one-sided amounts, and exact debit-equals-credit balance.
- Posting requires the business base currency, an open accounting period, active non-header accounts, and the applicable manual/control-account policy.
- Source type plus source ID prevents duplicate economic posting.
- Payload-bound idempotency returns the same journal only for an equivalent retry and rejects changed payloads.
- Deterministic advisory locks and bounded Serializable retries make simultaneous equivalent requests converge on one posted journal.
- Reversals are new exact-opposite entries linked to one original; posted history is never updated or deleted.
- Reversal chains and duplicate conflicting reversals are rejected.
- Successful postings and reversals create business audit events atomically.
- A focused migration-integrity verifier protects journal keys, checks, indexes, trigger functions, immutability, balance/account/period/reversal validation, and deferred finalization.
- The kernel is an internal service boundary; no browser or HTTP posting route exists.

## Current Phase 4 priority

Implement controlled opening balances and the first read-only journal/general-ledger evidence boundary without exposing ordinary manual transaction entry.

The next slice must provide:

1. a business cutover date and explicit opening-balance lifecycle;
2. balanced opening entries posted only through the central kernel;
3. stable source identity, idempotency, audit, reversal, and correction behavior;
4. account eligibility rules that prevent unsupported receivable, payable, inventory, VAT, bank, and retained-earnings shortcuts;
5. exact base-currency amounts and a clearly defined opening-equity balancing policy;
6. prevention of duplicate or conflicting opening sets under concurrency;
7. a read-only journal register and journal detail/general-ledger evidence view using `accounting.view`;
8. no update/delete path for posted history and no ordinary manual-journal form;
9. PostgreSQL constraints, migration-integrity protection, unit tests, integration tests, browser evidence for read-only history, Docker/runtime evidence, and updated operating documentation.

## Explicitly not implemented

- Ordinary manual journal-entry UI.
- Draft, recurring, or approval-based journals.
- Sales, purchase, bank, inventory, payroll, or project posting.
- Foreign-currency journals, exchange gains/losses, or revaluation.
- VAT calculation or returns.
- Receivable/payable allocation.
- Bank reconciliation.
- Trial balance, profit and loss, balance sheet, cash-flow, or aging reports.
- Period-closing checklist and retained-earnings transfer.

## Tracked non-blocking follow-up

- Pagination for capped registers.
- Dynamic filtering of account-type choices by selected class in the client form; server validation already enforces compatibility.
- Full contact/address editing and removal.
- Broader party/catalog/import audit coverage.
- File attachment target validation, stronger OOXML inspection, deployment request-size limits, and coordinated restore drills.
- Entitlement value-type constraints and subscription start/end-date enforcement.

## Active blockers

- Business transaction entry remains blocked until opening-balance cutover, read-only journal evidence, subledger policies, and the applicable VAT/document posting rules are implemented and verified.
