# Progress

Last updated: July 30, 2026
Current branch: `agent/opening-balance-import-summary`
Current phase: Phase 4 - Accounting kernel
Current slice: Opening-balance import preview summary/fingerprint - implementation branch open

## Evidence-based verified state

- Phases 1-3 are complete and merged through PR #25.
- PR #26 merged normally into `main` as `87782734a3ee32d8edf0d0e6353a5e40dc87ae5c`.
- PR #27 merged normally into `main` as `e4d8e7af1e8baad116dc7ef09d56800cf68d4544`.
- PR #28 implements the internal central posting kernel without exposing manual journal or document transaction entry.
- Implementation-head run `30469369143`, job `90635303570`, passed clean dependency installation, Prisma generation, forward migrations, migration status, supported schema diff, PostgreSQL catalog integrity, real base-to-head upgrade verification, lint, strict TypeScript, unit tests, PostgreSQL integration tests, production build, Playwright browser verification, Compose validation, migration/runtime image builds, booted runtime readiness, and protected outbox smoke.
- PR #29 added route-owned read-only posted-journal evidence and merged into `main` as `eb6a6cf0e6a189c9139e30d604585eee4e0bad70` after run `30475270032`, job `90655286041`, passed the full repository gate.
- PR #30 added controlled opening-balance backend posting and merged into `main` as `c5aadcc18ec5921760239ec9e2e5ebe4d71e7291` after run `30520307890`, job `90798976536`, passed the full repository gate before merge.
- PR #31 added the controlled opening-balance workspace page/API and merged into `main` as `90826025ca6caaf723145ecd722a2aba0ac89a77` after run `30521271272`, job `90801998695`, passed the full repository gate before merge.
- PR #32 added opening-balance CSV import preview and merged into `main` as `0fe56aabd1042af6e50cf3f9f369a0a5b857b9dd` after run `30522062675`, job `90804495506`, passed the full repository gate before merge.
- PR #33 added opening-balance posted-status lifecycle visibility and merged into `main` as `1966386e11293561bf06175fa9cf12664253ce92`; GitHub showed the PR as mergeable but attached no pull-request workflow run or commit status after repeated checks.
- PR #34 attempted to add a journal evidence detail page and merged into `main` as `323849b7f5d4cf6d6d955ad967fc8f2d2b08ca11`; follow-up verification found the canonical route already exists at `/business/[businessId]/accounting/journals/[journalId]`.
- PR #35 removed the duplicate `[journalEntryId]` journal route and merged into `main` as `e99cc2e5dd1a26048933a93c7f756e7246eb71a6`; follow-up verification confirmed the canonical `[journalId]` route exists, the duplicate route is absent, no open PRs remained, and no workflow/status objects were attached to the merge commit.
- PR #36 added the opening-balance blocked policy matrix and merged into `main` as `4dc5b8389a5bcc5fd6d8e1f4537b7fceff9a6e0b` after CI run `30524938603`, job `90813581732`, passed the full repository gate before merge.
- PR #37 centralized the blocked opening-balance policy matrix in `src/modules/accounting/contracts/opening-balance-policies.ts` and merged into `main` as `3d78e05cfd7ddd31a0a8af035446d776016c17bb` after CI run `30526198564`, job `90817561958`, passed the full repository gate before merge.
- Better Auth uses PostgreSQL-backed revocable sessions.
- Business access requires active tenant/business memberships and an active subscription.
- Shared master data, files, audit, numbering, exports, custom fields, queued email, browser E2E, migration integrity, and immutable tenant access history remain covered by the repository gate.
- No manual journal UI, document posting, VAT posting, allocations, reconciliation, or financial statements are exposed.

## Active branch progress

- `agent/opening-balance-import-summary` adds an `OpeningBalanceImportSummary` to the CSV parser result.
- The summary records row count, debit total, credit total, net difference, and a deterministic browser-safe preview fingerprint over normalized import rows.
- The opening-balance workspace displays the import summary after a successful CSV preview and clears it when rows are manually changed.
- Unit coverage verifies import summary totals and stable fingerprinting for equivalent imports.
- `ACCOUNTING_OPENING_BALANCES.md` records the preview summary/fingerprint as operator review evidence.
- This branch intentionally adds no durable import batches, draft workflow, approval workflow, schema change, posting API change, or ordinary manual journal workflow.
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
- Posted journal history is visible through read-only route-owned register and detail pages using `accounting.view`.
- Controlled opening balances are posted only through the dedicated opening-balance service and workspace route, not through a general manual journal entry path.

## Current Phase 4 priority

Verify and merge the opening-balance import preview summary/fingerprint, then move into durable opening-balance drafts/import batches or subledger-safe opening policies.

The broader opening-balance workflow still needs:

1. durable draft/approval controls if needed;
2. durable import batches if needed;
3. subledger-safe opening policies for receivables, payables, inventory, VAT, bank reconciliation, and projects;
4. reversal/correction UX for posted opening balances;
5. browser evidence and operating documentation for the full workflow.

## Explicitly not implemented

- Durable opening-balance import batches.
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

- Ordinary business transaction entry remains blocked until durable opening-balance lifecycle, subledger policies, and the applicable VAT/document posting rules are implemented and verified.
