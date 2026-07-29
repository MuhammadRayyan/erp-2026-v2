# Accounting Foundation

This guide defines the implemented Phase 4 chart-of-accounts boundary. The current accounting workspace manages structure only. It does not create balances, journals, opening entries, tax postings, allocations, or financial statements.

## Scope

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

## Account kinds

### Header

Header accounts organize the chart. They:

- use the `GENERAL` type;
- cannot receive manual postings;
- may contain same-class child accounts;
- cannot be deactivated while active children remain.

### Posting

Posting accounts are intended for future journal lines. The current phase only stores their structure. A later posting kernel must still check account status, period state, posting policy, and document source before using them.

### Control

Control accounts are reserved for module-owned balances such as receivables, payables, inventory, VAT, and retained earnings. They cannot receive manual postings. Future subledgers and period close workflows must post to them only through the central accounting kernel.

## Default chart

Existing businesses receive the default chart through the forward migration. New businesses receive the same deterministic template inside the serializable onboarding transaction.

The template is designed for a small UAE business and includes:

- current and non-current assets;
- cash, bank, trade receivables, inventory, prepayments, and recoverable VAT;
- property/equipment and accumulated depreciation;
- current and non-current liabilities;
- trade payables, VAT payable, accruals, and loans;
- owner capital and retained earnings;
- sales, service, and other income;
- cost of goods sold and direct costs;
- common operating expenses.

Stable `systemKey` values identify future posting policies. Required system accounts remain active. Optional VAT and inventory controls may exist before those modules are enabled; their presence does not create balances or statutory treatment.

## Lifecycle and edit rules

There is no hard-delete API or service.

- Custom accounts may change structural classification when hierarchy rules remain valid.
- System-managed account structure is immutable: class, type, balance, kind, contra flag, manual-posting policy, hierarchy, required flag, and system-managed state cannot be changed.
- System account code, name, and description remain editable for local presentation while `systemKey` stays stable.
- Required system accounts cannot be deactivated.
- A header cannot be deactivated while active children exist.
- An account cannot reactivate beneath an inactive parent.
- Deactivation preserves the record and business audit history.

Future posting data must add stronger restrictions: once an account has journal history, economically meaningful classification changes must be prohibited or handled through an explicit migration/correction workflow.

## Hierarchy invariants

PostgreSQL and the service boundary enforce:

- parent and child belong to the same tenant and business;
- parent is a header account;
- parent and child share the same class;
- active children require an active parent;
- an account cannot parent itself;
- hierarchy cycles are rejected;
- a header with children cannot become a posting/control account;
- a parent class cannot change while children exist.

## Authorization and entitlement

- `accounting.view` reads the chart.
- `accounting.manage` creates, edits, activates, and deactivates accounts.
- `accounting.core` must be enabled for the tenant.
- Viewer roles remain read-only.
- Every create, update, and status transition produces a business-scoped audit event.

## Migration safety

The migration-integrity manifest protects:

- composite business and parent foreign keys;
- classification, balance, kind, system, required, code, and name checks;
- the hierarchy trigger and function;
- real base-to-head upgrades.

The upgrade fixture proves that existing user, tenant, business, unit, and party records survive while the preserved business receives the default chart with required receivable and retained-earnings controls.

## Verification

Automated coverage verifies:

- template consistency and normal-balance derivation;
- onboarding installation and migration backfill;
- account create/edit/activate/deactivate behavior;
- business audit events;
- system/required protection;
- invalid class/type/balance/kind combinations;
- hierarchy cycles and active-child rules;
- cross-tenant parent rejection;
- RBAC and entitlement denial;
- owner creation and viewer read-only behavior through the production browser workflow;
- resilient serializable onboarding retries after the larger atomic setup transaction.

## Explicitly not implemented

The following remain blocked:

- accounting periods and locks;
- opening balances;
- journal entry or journal line models;
- posted balances;
- document posting;
- tax calculation and VAT returns;
- receivable/payable allocation;
- bank reconciliation;
- trial balance, profit and loss, balance sheet, or general ledger reports;
- closing and retained-earnings transfer;
- reversals and correction journals.

The next Phase 4 slice is accounting periods and locks. The balanced, idempotent posting kernel follows only after period enforcement is verified.