# Project Plan

## Product goal

Build a structured UAE-first ERP for owner-operated and small businesses. The product must support complete daily workflows for technical services, automotive workshops, civil/architectural work, and general service/trading businesses.

## Product hierarchy

Platform → Tenant → Business → Projects/Jobs and operational records.

Tenant administration controls users, businesses, plans, and limits. Business membership controls operational access. Platform administration remains separate from normal business work.

## Architecture

Use a full-stack Next.js modular monolith, PostgreSQL, Prisma, a worker process from the same codebase, private storage adapters, and Docker Compose. Do not add NestJS, Redis, Turborepo, microservices, or Kubernetes without a measured need.

## Non-negotiable principles

- All financial effects flow through one double-entry posting kernel.
- Posted records are corrected through linked reversals, credits, debits, or returns.
- Money and tax use exact decimal values.
- Tenant and business scope is enforced server-side.
- Authentication, permissions, approvals, entitlements, limits, and document state are separate gates.
- Modules register navigation, permissions, entitlements, audit events, reports, and tests.
- External email, storage, PDF, billing, and e-invoicing systems remain behind adapters.
- Core workflows outrank optional or enterprise features.

## Main product areas

- Account Hub
- Business Workspace
- Tenant Administration
- Platform Administration

## Initial core workflows

Sales: customer → quotation → order → delivery/service completion → invoice → receipt → credit/refund.

Purchases: supplier → request/quotation → purchase order → goods/service receipt → supplier invoice → payment → debit/return.

Operations: project/job → tasks/visits → labour/material/purchase/expense → completion → invoice → profitability.

## Definition of done

A module is complete only when the end-to-end workflow, authorization, accounting/tax effects, corrections, migrations, edge cases, tests, UI states, reports, documents, and context updates are verified.
