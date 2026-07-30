# Progress

Last updated: July 30, 2026
Current branch: `agent/opening-balance-posting`
Current phase: Phase 4 — Accounting kernel
Current slice: Controlled opening-balance backend posting boundary — implementation branch open

## Evidence-based verified state

- Phases 1–3 are complete and merged through PR #25.
- PR #26 merged normally into `main` as `87782734a3ee32d8edf0d0e6353a5e40dc87ae5c`.
- PR #27 merged normally into `main` as `e4d8e7af1e8baad116dc7ef09d56800cf68d4544`.
- PR #28 implements the internal central posting kernel without exposing manual journal or document transaction entry.
- Implementation-head run `30469369143`, job `90635303570`, passed clean dependency installation, Prisma generation, forward migrations, migration status, supported schema diff, PostgreSQL catalog integrity, real base-to-head upgrade verification, lint, strict TypeScript, unit tests, PostgreSQL integration tests, production build, Playwright browser verification, Compose validation, migration/runtime image builds, booted runtime readiness, and protected outbox smoke.
- PR #29 added route-owned read-only posted-journal evidence and merged into `main` as `eb6a6cf0e6a189c9139e30d604585eee4e0bad70` after run `30475270032`, job `90655286041`, passed the full repository gate.
- Better Auth uses PostgreSQL-backed revocable sessions.
- Business access requires active tenant/business memberships and an active subscription.
- Shared master data, files, audit, numbering, exports, custom fields, queued email, browser E2E, migration integrity, and immutable tenant access history remain covered by the repository gate.
- No manual journal UI, document posting, VAT posting, allocations, reconciliation, or financial statements are exposed.

## Active branch progress

- `agent/opening-balance-posting` adds an opening-balance contract and backend service that posts one controlled opening set through the central journal kernel.
- The service requires `accounting.manage` and `accounting.core`, uses the business base currency, and posts with source type `OPENING_BALANCE` plus business-scoped source ID `OPENING_BALANCES`.
- The service auto-balances net opening debit/credit differences to the default active `OWNER_CAPITAL` account and does not post to retained earnings.
- The service rejects header accounts, control accounts, revenue/expense accounts, bank accounts, receivable/payable/inventory/VAT/retained-earnings shortcut accounts, and direct use of the reserved owner-capital balancing account as an input line.
- Unit and PostgreSQL integration coverage verifies contract shape, owner-capital balancing, equivalent idempotent retry behavior, conflicting duplicate-source rejection, and blocked account policies.
- This branch intentionally adds no opening-balance UI, no import path, no public posting route, no ordinary manual journal workflow, and no schema change.
- CI for this branch is pending PR creation and GitHub Actions execution.

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
- Posted journal history is visible through read-only route-owned register and detail pages using `accounting.view`.

## Current Phase 4 priority

Verify and merge the controlled opening-balance backend boundary, then add an opening-balance UI/import lifecycle only after the backend policy is stable.

The broader opening-balance workflow still needs:

1. a business cutover lifecycle visible in the workspace;
2. draft/approval/import controls if needed;
3. subledger-safe opening policies for receivables, payables, inventory, VAT, bank reconciliation, and projects;
4. reversal/correction UX for posted opening balances;
5. browser evidence and operating documentation for the full workflow.

## Explicitly not implemented

- Opening-balance UI or import workflow.
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

- Ordinary business transaction entry remains blocked until opening-balance UI/lifecycle, subledger policies, and the applicable VAT/document posting rules are implemented and verified.
