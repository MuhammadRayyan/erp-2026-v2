# Accounting Foundation

This guide defines the implemented Phase 4 accounting structure boundary. The Accounting workspace manages the chart of accounts and business accounting periods. It still does not create balances, journals, opening entries, tax postings, allocations, or financial statements.

## Chart of accounts

Each business owns a tenant-scoped chart containing:

- asset, liability, equity, revenue, and expense classes;
- constrained account types;
- debit or credit normal balance;
- optional contra behavior;
- header, posting, or control kind;
- manual-posting policy;
- active or inactive lifecycle status;
- optional parent header;
- stable system key, required flag, and system-managed flag for defaults.

`LedgerAccount` is intentionally named separately from Better Auth's `Account` model.

### Account kinds

- **Header accounts** organize same-class child accounts and never accept manual postings.
- **Posting accounts** are eligible for future journal lines only after the posting kernel validates status, period, source, policy, and authority.
- **Control accounts** are reserved for module-owned balances such as receivables, payables, inventory, VAT, and retained earnings. Future subledgers may use them only through the central accounting kernel.

### Default chart

Existing businesses receive the default chart through a forward migration. New businesses receive the same deterministic template inside serializable onboarding.

The UAE-oriented small-business template includes current and non-current assets, cash, bank, receivables, inventory, prepayments, recoverable VAT, fixed assets, depreciation, payables, VAT payable, accruals, loans, owner equity, retained earnings, revenue, cost of goods sold, direct costs, and common operating expenses.

Stable `systemKey` values identify future posting policies. Required system accounts remain active. Optional VAT and inventory controls may exist before those modules are enabled; their presence creates no balances or statutory treatment.

### Lifecycle and hierarchy rules

There is no hard-delete service or API.

- System-managed classification, normal balance, kind, hierarchy, required status, and system identity remain immutable.
- System account code, name, and description may be localized while `systemKey` remains stable.
- Required controls cannot be deactivated.
- Headers cannot be deactivated while active children exist.
- Accounts cannot reactivate beneath inactive parents.
- Parent and child must belong to the same tenant/business and class.
- Parents must be headers, self-parenting and cycles are rejected, and a header with children cannot become a posting/control account.

Future journal history will require even stronger restrictions on economically meaningful account changes.

## Accounting periods and locks

Each business owns non-overlapping date periods contained in one configured fiscal year.

- **Open** periods allow the future posting kernel to accept dates, subject to all other accounting controls.
- **Soft locked** periods reject ordinary posting while month-end review is in progress.
- **Closed** periods reject posting until an authorized, reasoned reopen.

Every lock, close, and reopen requires a reason and creates business audit evidence. Dates become immutable after a period leaves open status. Periods cannot be deleted.

The fiscal-year start month becomes immutable through ordinary business settings after the first period exists. This prevents settings changes from invalidating established period coverage.

`assertAccountingDateOpen` is the reusable transaction-bound guard for the next posting-kernel slice. The future journal transaction must call it inside the same database transaction as source idempotency, journal creation, and reversal linkage.

See `ACCOUNTING_PERIODS.md` for status transitions, PostgreSQL enforcement, concurrency, authorization, migration, and verification details.

## Authorization and entitlement

- `accounting.view` reads the chart and period register.
- `accounting.manage` administers accounts and periods.
- `accounting.core` must be enabled for the tenant.
- Viewer roles remain read-only.
- Every account or period create, update, and status transition produces a business-scoped audit event.

## Migration safety

The migration-integrity gates protect:

- composite business and hierarchy foreign keys;
- account classification, balance, kind, system, required, code, and name checks;
- the chart hierarchy trigger/function;
- accounting-period scope, content, state, and metadata checks;
- the period validation trigger/function;
- clean migration replay and real base-to-head upgrades.

The upgrade fixture distinguishes whether the chart migration already exists in the PR base. It requires chart backfill when that migration is introduced by the head, preserves established chart behavior when it is already in the base, and verifies that the period migration introduces no transactional accounting data.

## Verification

Automated coverage verifies:

- chart-template consistency and normal-balance derivation;
- onboarding chart installation and historical migration backfill;
- account create/edit/activate/deactivate behavior;
- account hierarchy, lifecycle, system, RBAC, entitlement, audit, and tenant-isolation rules;
- accounting-period date contracts and fiscal-year calculations;
- period create, edit, list, soft lock, close, reopen, and audit behavior;
- non-overlap, concurrent creation, fiscal-year boundaries, invalid transitions, and direct-delete rejection;
- the posting-date guard for missing, open, soft-locked, and closed dates;
- period RBAC, entitlement, and tenant isolation;
- fiscal-year settings protection after period creation;
- production browser workflows;
- clean installation, real upgrade, build, Docker, readiness, and runtime gates.

## Explicitly not implemented

The following remain blocked:

- opening balances;
- journal entry or journal line models;
- posted balances;
- document posting;
- soft-lock posting override authority;
- tax calculation and VAT returns;
- receivable/payable allocation;
- bank reconciliation;
- trial balance, profit and loss, balance sheet, or general ledger reports;
- closing checklist and retained-earnings transfer;
- reversals and correction journals.

The next Phase 4 slice is one central balanced and idempotent posting kernel with source uniqueness, period enforcement, active-account validation, control-account policy, and linked reversals. No financial transaction entry may be exposed before that kernel passes the complete repository gate.
