# Modules and Phases

## Phase 0 — Verified baseline

Repository, Git, configuration, migrations, tests, Docker, and context are inspected and reproducible.

## Phase 1 — Application foundation

Real Account Hub, Business Workspace, Tenant Admin, and Platform Admin routes; module registry; shared UI patterns; configuration; PostgreSQL/Prisma; Docker; CI.

## Phase 2 — Identity and access

Better Auth sessions, tenant ownership, business membership, invitations, RBAC, capabilities, entitlements, and limits. Tenant and business isolation must be integration-tested.

## Phase 3 — Shared ERP foundations

Business onboarding/settings, parties, contacts, items/services, units, custom fields, private files, numbering, lists, forms, imports, exports, and audit/history foundations.

## Phase 4 — Accounting kernel

Chart of accounts, journals, posting policies, periods, locks, reversals, opening balances, receivables/payables, allocations, multi-currency, and core reports.

## Phase 5 — UAE VAT

Effective-dated registration, canonical calculation engine, tax documents, corrections, VAT reports, and reconciliation.

## Phase 6 — Sales

Customer policy, quotations/revisions, sales orders, delivery/service completion, invoices, receipts, credits/refunds, statements, and aging.

## Phase 7 — Purchases

Supplier policy, requests/quotations, purchase orders, goods/service receipts, supplier invoices, matching, payments, debit notes, and statements.

## Phase 8 — Banking

Bank/cash accounts, receipts/payments/transfers, statement import, matching, reconciliation, and bank reporting.

## Phase 9 — Documents and resilience

Private files, versioned templates, PDFs, queued email, worker/outbox, portable business packages, infrastructure backup, and restore verification.

## Phase 10 — Inventory

Warehouses, stock movements, reservations, valuation, COGS, returns, counts, and ledger reconciliation.

## Phase 11 — Projects and jobs

Projects/jobs, tasks/visits, time, labour, materials, purchases, expenses, subcontracting, completion, billing, and profitability.

## Phase 12 — Industry profiles

Complete Technical Services, Automotive Workshop, and Civil/Architectural workflows using shared modules and profile defaults.

## Phase 13 — Reporting and operations

Financial and operational dashboards, reports, exports, health, failed jobs, backups, and recovery procedures.

## Phase 14 — UAE e-invoicing and commercial SaaS

Canonical structured invoice mapping, accredited-provider adapter, submission lifecycle, public onboarding, billing, stronger platform controls, and production compliance verification.

## Completion rule

Each phase is divided into coherent iterations. Scaffolding, file presence, or a happy path never counts as phase completion.
