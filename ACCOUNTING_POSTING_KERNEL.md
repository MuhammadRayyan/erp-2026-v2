# Central Accounting Posting Kernel

This guide defines the verified Phase 4 journal-posting boundary. The kernel is an internal application service and database contract. It does not expose a manual journal form, public posting API, opening-balance workflow, sales or purchase posting, VAT posting, allocation, reconciliation, or financial statements.

## Scope

Every accepted posting creates one tenant/business-scoped journal header and two or more journal lines containing:

- an accounting date covered by an open accounting period;
- the business base currency;
- a controlled origin;
- stable source type and source identifier;
- a stable idempotency key and payload hash;
- exact debit and credit amounts stored to four decimal places;
- the actor and immutable posting time;
- optional memo and reversal lineage.

The first release accepts base-currency journals only. Foreign-currency transaction amounts, exchange rates, realized gains or losses, and revaluation remain future work.

## Posting lifecycle

A journal is created as `PENDING` only inside the posting transaction. Its lines are inserted, the complete entry is validated, and the header becomes `POSTED` before commit.

A deferred PostgreSQL constraint trigger rejects any transaction that attempts to commit a pending journal. No incomplete journal may remain in the database after a successful commit.

Posted headers and lines are immutable. Corrections are represented by later linked postings rather than updates or deletes.

## Read-only journal evidence

The business accounting workspace exposes posted journal history through read-only route-owned pages:

- `/business/[businessId]/accounting/journals` lists posted journals for the active business;
- `/business/[businessId]/accounting/journals/[journalId]` shows source identity, idempotency key, memo, accounting date, posting time, reversal lineage, and immutable lines.

These pages use `accounting.view` and `accounting.core` through the same server-side business access boundary as the chart and period pages. They do not expose create, update, delete, import, reversal, or manual-posting controls.

## Balance and line rules

The application service and PostgreSQL independently require:

- at least two lines;
- each line to contain a positive debit or a positive credit, never both;
- total debits to equal total credits exactly;
- a positive journal total;
- stable positive line numbers;
- unique line numbers within the journal;
- all lines to belong to the same tenant and business as the header.

The kernel uses exact decimal arithmetic. Floating-point money is not accepted.

## Account policy

Before posting, the kernel locks and validates every referenced ledger account.

- The account must exist in the active tenant and business.
- The account must be active.
- Header accounts cannot receive journal lines.
- Manual-origin journals may use only normal posting accounts whose manual-posting flag is enabled.
- Control accounts are reserved for system-owned module policies and are not available to ordinary manual posting.

The database repeats the economically important account checks when the journal is finalized so direct or future alternate write paths cannot bypass the service boundary.

## Period policy

The kernel calls `assertAccountingDateOpen` inside the same Serializable transaction that creates and finalizes the journal.

Posting is rejected when:

- no accounting period covers the date;
- the covering period is soft locked;
- the covering period is closed.

A concurrent period transition and posting cannot both succeed in a way that violates the final period state.

## Source identity and idempotency

Each journal has two independent business-scoped identities:

1. source type plus source ID prevents one source document or operation from being posted twice;
2. the idempotency key permits a safe retry only when the normalized payload is identical.

Reusing an idempotency key with changed dates, accounts, amounts, origin, source identity, memo, or lines is rejected. Reusing a source identity under another idempotency key is also rejected.

Posting transactions acquire deterministic transaction-scoped advisory locks for both identities. Serializable write conflicts are retried with bounded backoff and a fresh transaction. After a competing transaction commits, the retry rechecks the stored payload and returns the same posted journal when equivalent.

## Reversals and corrections

A reversal is a new posted journal linked to one original posted journal.

- Every debit becomes the matching credit and every credit becomes the matching debit.
- Account identity, line order, currency, and total are preserved.
- The reversal uses its own accounting date and must pass the current open-period guard.
- The original journal remains unchanged.
- Only one reversal may link to an original journal.
- A reversal cannot itself be reversed, preventing reversal chains.
- Equivalent reversal retries return the existing reversal; conflicting retries are rejected.

Later business correction workflows may add a replacement entry after the reversal, but they must never mutate historical journals.

## Authorization, entitlement, and audit

- `accounting.manage` is required to call the internal posting and reversal services.
- `accounting.view` may read posted journals through the service boundary.
- `accounting.core` must be enabled for the tenant.
- The current slice exposes no browser or HTTP posting route.

A successful posting or reversal writes a business audit event inside the same database transaction. Audit metadata records safe structural evidence such as date, currency, origin, source identity, line count, totals, and reversal linkage without storing secrets.

## Database and migration protection

The forward migration introduces journal enums, headers, lines, composite scope, source and idempotency uniqueness, reversal uniqueness, amount and content checks, immutable-history triggers, balance/period/account/reversal validation, and deferred finalization protection.

`npm run db:verify-integrity` includes a focused journal catalog verifier. It fails when required keys, checks, indexes, trigger functions, trigger timing, or deferred behavior disappear or weaken.

The pull-request gate also proves clean migration replay and a real base-to-head upgrade from the exact target commit.

## Automated evidence

Coverage verifies:

- exact balanced posting and immutable history;
- equivalent idempotent retries and changed-payload rejection;
- duplicate source rejection;
- unbalanced and incomplete pending-journal rejection;
- base-currency enforcement;
- missing, cross-tenant, inactive, header, control, and manual-account policy;
- soft-locked and closed-period rejection;
- exact linked reversals and reversal-chain prevention;
- concurrent equivalent requests producing one journal;
- migration catalog integrity and upgrade preservation;
- lint, strict TypeScript, unit tests, the complete PostgreSQL suite, production build, Playwright regression, Compose validation, migration/runtime images, runtime readiness, and protected outbox smoke.

Implementation-head run `30469369143`, job `90635303570`, passed the complete repository gate. The read-only journal evidence branch must pass a fresh pull-request gate before merge.

## Explicitly not implemented

- manual journal-entry UI or public write route;
- opening balances;
- recurring or draft journals;
- attachments or approval workflow for journals;
- foreign-currency journals and exchange-rate effects;
- receivable, payable, inventory, bank, payroll, project, sales, or purchase subledger posting;
- VAT calculation or tax-document posting;
- allocations and settlements;
- bank reconciliation;
- trial balance, general-ledger report, profit and loss, balance sheet, cash-flow, or aging reports;
- soft-lock override posting;
- period-closing checklist or retained-earnings transfer.

The next coherent Phase 4 slice is controlled opening balances. Opening balances must post through this kernel, remain idempotent and reversible, prohibit unsupported control-account shortcuts, and preserve a clear cutover date before any manual transaction-entry workflow is considered.
