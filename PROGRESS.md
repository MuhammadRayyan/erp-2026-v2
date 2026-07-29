# Progress

Last updated: July 29, 2026
Current branch: `phase-4-chart-of-accounts`
Current phase: Phase 4 — Accounting kernel
Current slice: Chart of accounts and account lifecycle

## Evidence-based verified state

- Phases 1–3 are complete and merged through PR #25.
- Better Auth uses PostgreSQL-backed revocable sessions.
- Business access requires active tenant/business memberships and an active subscription.
- Shared master data, files, audit, numbering, exports, custom fields, queued email, browser E2E, migration integrity, and immutable tenant access history remain covered by the repository gate.
- PR #26 implements the first Phase 4 structural slice without introducing balances or posting.
- Implementation-head run `30442778259`, job `90545780793`, passed clean dependency installation, Prisma generation, all forward migrations, clean migration history/diff/catalog verification, real base-to-head upgrade with default-chart backfill, lint, strict TypeScript, unit tests, PostgreSQL integration tests, production build, owner/viewer accounting Playwright verification, Compose validation, both Docker image builds, runtime boot, database readiness, and protected outbox smoke.

## Chart of accounts implemented in PR #26

- Added tenant/business-scoped `LedgerAccount`, separate from Better Auth's `Account` model.
- Added asset, liability, equity, revenue, and expense classes.
- Added constrained account types, debit/credit normal balance, contra behavior, and header/posting/control kinds.
- Added manual-posting policy, active/inactive status, optional parent header, stable system keys, required controls, and system-managed defaults.
- Added composite business and parent foreign keys plus unique business code/system-key constraints.
- Added PostgreSQL checks for code/name, class/type, normal balance/contra, kind/manual posting, system metadata, and required status.
- Added a PostgreSQL hierarchy trigger for same-business/same-class header parents, active-parent rules, cycle prevention, active-child protection, stable system keys, and immutable system structure.
- Backfilled every existing business with a deterministic UAE-oriented small-business chart.
- Installed the same default chart atomically for new businesses during serializable onboarding.
- Added `accounting.core` through the normalized feature/plan entitlement path.
- Added protected accounting navigation, register/detail pages, filters, create/edit/status controls, and explicit structure-only warnings.
- Added accounting.view/accounting.manage RBAC and viewer read-only enforcement.
- Added business audit events for account creation, updates, activation, and deactivation.
- Added no hard-delete path.
- Expanded migration integrity to cover chart foreign keys, checks, and hierarchy trigger/function.
- Extended real base-to-head upgrade verification to prove preserved Phase 3 data and default-chart installation.
- Hardened onboarding retry detection for Prisma, PostgreSQL, and adapter serialization-conflict shapes after the larger atomic setup transaction.

## Verified behavior

- Default chart includes required receivable, payable, and retained-earnings controls, common UAE VAT controls, cash/bank, assets/liabilities/equity, revenue, cost of sales, and operating expenses.
- Control and header accounts block manual posting.
- Accumulated depreciation uses a credit normal balance as a contra asset.
- Required system accounts cannot be deactivated.
- System-managed class, type, balance, kind, contra flag, posting policy, parent, required flag, and system-managed state are immutable; code, name, and description remain editable while systemKey stays stable.
- Headers with active children cannot be deactivated.
- Children cannot be activated beneath an inactive parent.
- Invalid class/type/balance/kind combinations and cross-tenant parents are rejected.
- PostgreSQL rejects hierarchy cycles.
- Owners can create custom accounts; viewers can read the chart but cannot use the form or direct write API.

## Explicitly not implemented

- Accounting periods or locks.
- Opening balances.
- Journal entries or lines.
- Posted balances or general ledger.
- Document posting.
- VAT calculation/returns.
- Receivable/payable allocation.
- Bank reconciliation.
- Financial statements.
- Closing, retained-earnings transfer, reversals, or correction journals.

## Next Phase 4 priority

1. Implement business-scoped accounting periods and date locks.
2. Define open, soft-locked, and closed states with clear authority and reason metadata.
3. Prevent overlapping periods and enforce fiscal-date coverage.
4. Add reopen controls, audit history, concurrency protection, migration integrity, and owner/accountant permissions.
5. Only then implement the central balanced posting kernel with idempotency and reversals.
6. Keep all journal/document transaction entry hidden until balance, scope, lock, retry, and reversal invariants pass PostgreSQL integration tests.

## Tracked non-blocking follow-up

- Pagination for capped registers.
- Dynamic filtering of account-type choices by selected class in the client form; server validation already enforces compatibility.
- Full contact/address editing and removal.
- Broader party/catalog/import audit coverage.
- File attachment target validation, stronger OOXML inspection, deployment request-size limits, and coordinated restore drills.
- Entitlement value-type constraints and subscription start/end-date enforcement.

## Active blockers

- PR #26 must pass the same complete gate on its synchronized documentation head and merge normally before this chart slice is complete.
- Accounting transaction entry remains blocked by periods/locks, the balanced posting kernel, idempotency, and reversal policy.