# Accounting Foundation

This guide defines the implemented Phase 4 accounting boundary. The repository now contains chart structure, accounting periods, and an internal central posting kernel. It still does not expose ordinary manual journals, opening-balance entry, sales or purchase posting, VAT posting, allocations, reconciliation, or financial statements.

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

- **Header accounts** organize same-class child accounts and never accept journal lines.
- **Posting accounts** may receive journal lines after the posting kernel validates status, period, source, policy, and authority.
- **Control accounts** are reserved for module-owned balances such as receivables, payables, inventory, VAT, and retained earnings. Ordinary manual-origin posting cannot use them.

### Default chart

Existing businesses receive the default chart through a forward migration. New businesses receive the same deterministic template inside serializable onboarding.

The UAE-oriented small-business template includes current and non-current assets, cash, bank, receivables, inventory, prepayments, recoverable VAT, fixed assets, depreciation, payables, VAT payable, accruals, loans, owner equity, retained earnings, revenue, cost of goods sold, direct costs, and common operating expenses.

Stable `systemKey` values identify posting policies. Required system accounts remain active. Optional VAT and inventory controls may exist before those modules are enabled; their presence creates no balance or statutory treatment by itself.

### Lifecycle and hierarchy rules

There is no hard-delete service or API.

- System-managed classification, normal balance, kind, hierarchy, required status, and system identity remain immutable.
- System account code, name, and description may be localized while `systemKey` remains stable.
- Required controls cannot be deactivated.
- Headers cannot be deactivated while active children exist.
- Accounts cannot reactivate beneath inactive parents.
- Parent and child must belong to the same tenant/business and class.
- Parents must be headers, self-parenting and cycles are rejected, and a header with children cannot become a posting/control account.
- Posted journal history prevents economically unsafe direct mutation through the journal boundary; broader account-change restrictions may be added as subledgers and reporting mature.

## Accounting periods and locks

Each business owns non-overlapping date periods contained in one configured fiscal year.

- **Open** periods allow the posting kernel to accept dates, subject to all other accounting controls.
- **Soft locked** periods reject ordinary posting while month-end review is in progress.
- **Closed** periods reject posting until an authorized, reasoned reopen.

Every lock, close, and reopen requires a reason and creates business audit evidence. Dates become immutable after a period leaves open status. Periods cannot be deleted.

The fiscal-year start month becomes immutable through ordinary business settings after the first period exists. This prevents settings changes from invalidating established period coverage.

`assertAccountingDateOpen` is the authoritative transaction-bound posting-date guard. The journal transaction calls it inside the same Serializable transaction as source idempotency, journal creation, line creation, finalization, audit, and reversal linkage.

See `ACCOUNTING_PERIODS.md` for status transitions, PostgreSQL enforcement, concurrency, authorization, migration, and verification details.

## Central posting kernel

Every posted financial effect must use the internal journal service.

The kernel provides:

- tenant/business-scoped journal headers and lines;
- exact four-decimal debit and credit amounts;
- a transaction-local pending state that must become posted before commit;
- exact debit-equals-credit validation in the service and PostgreSQL;
- base-currency-only posting for the initial release;
- active-account, header-account, manual-posting, and control-account policy;
- stable source identity and payload-bound idempotency;
- deterministic advisory locks and bounded Serializable retry handling;
- immutable posted history;
- exact opposite linked reversals without reversal chains;
- atomic business audit events;
- focused migration-integrity verification.

No browser or HTTP posting route is exposed. Future modules must call the kernel rather than write journal tables directly.

See `ACCOUNTING_POSTING_KERNEL.md` for the full posting, idempotency, concurrency, reversal, and safety contract.

## Authorization and entitlement

- `accounting.view` reads chart, period, and posted-journal data through service boundaries.
- `accounting.manage` administers accounts and periods and is required by internal posting/reversal services.
- `accounting.core` must be enabled for the tenant.
- Viewer roles remain read-only.
- Every meaningful account/period change and every successful posting/reversal produces a business-scoped audit event inside the same transaction as the state change.

## Migration safety

The migration-integrity gates protect:

- composite business and hierarchy foreign keys;
- account classification, balance, kind, system, required, code, and name checks;
- the chart hierarchy trigger/function;
- accounting-period scope, content, state, and metadata checks;
- the period validation trigger/function;
- journal scope, source, idempotency, reversal, line-number, amount, and content checks;
- journal balance, period, account, reversal, immutability, and deferred-finalization trigger functions;
- clean migration replay and real base-to-head upgrades.

The upgrade fixture distinguishes which accounting migrations already exist in the pull-request base and verifies preservation of representative prior data. The posting-kernel migration introduces no automatic journal or balance rows.

## Verification

Automated coverage verifies:

- chart-template consistency and normal-balance derivation;
- onboarding chart installation and historical migration backfill;
- account create/edit/activate/deactivate behavior;
- account hierarchy, lifecycle, system, RBAC, entitlement, audit, and tenant-isolation rules;
- accounting-period contracts, transitions, concurrency, fiscal-year rules, and posting-date guards;
- exact balanced posting and immutable journal history;
- idempotent retries, changed-payload conflicts, and duplicate-source rejection;
- account, currency, tenant, and period posting policies;
- exact linked reversals and reversal-chain prevention;
- concurrent equivalent posting convergence after bounded serialization retries;
- production browser regressions;
- clean installation, real upgrade, build, Docker, readiness, and runtime gates.

Implementation-head run `30469369143`, job `90635303570`, passed the complete repository gate.

## Explicitly not implemented

The following remain blocked:

- controlled opening balances;
- ordinary manual journal-entry UI or public write route;
- draft, recurring, attachment, or approval-based journals;
- foreign-currency journals, exchange gains/losses, and revaluation;
- sales, purchase, bank, inventory, payroll, project, or other document posting;
- soft-lock posting override authority;
- tax calculation and VAT returns;
- receivable/payable allocation;
- bank reconciliation;
- trial balance, profit and loss, balance sheet, cash-flow, aging, or general-ledger reports;
- closing checklist and retained-earnings transfer.

The next Phase 4 slice is controlled opening balances plus a read-only journal/general-ledger evidence boundary. No ordinary transaction-entry workflow may be exposed until its subledger, tax, correction, and reporting policies are implemented and verified.
