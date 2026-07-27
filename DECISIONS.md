# Architecture Decisions

## ADR-001 — Structured Next.js modular monolith

**Status:** Accepted

Use one full-stack Next.js application plus a worker from the same codebase. This minimizes operational overhead while preserving module boundaries.

## ADR-002 — PostgreSQL and Prisma

**Status:** Accepted

Use PostgreSQL as the system of record and Prisma for typed access and migrations, with reviewed SQL where locking, constraints, sequences, or reporting require it.

## ADR-003 — Database-backed sessions

**Status:** Accepted

Use a maintained self-hosted authentication library and revocable PostgreSQL sessions. ERP authorization remains separate.

## ADR-004 — Tenant and business membership are distinct

**Status:** Accepted

Tenant access controls account administration; business membership controls operational access and roles.

## ADR-005 — Central accounting kernel

**Status:** Accepted

All posted financial effects use one journal kernel and explicit posting policies.

## ADR-006 — PostgreSQL outbox before Redis

**Status:** Accepted

Use durable outbox processing initially. Add Redis only after measured need.

## ADR-007 — Industry profiles, not forks

**Status:** Accepted

Technical services, automotive, and civil/architectural workflows configure shared modules.

## ADR-008 — Proportionate security

**Status:** Accepted

Implement essential web, financial, file, and backup security now; defer enterprise overhead until public SaaS use.

## ADR-009 — Normalized tenant plans and entitlements

**Status:** Accepted

Store feature definitions, plan assignments, tenant subscriptions, tenant overrides, and usage limits as normalized records. Permissions determine whether a user may act; entitlements determine whether the tenant has the feature; limits determine remaining capacity. The internal-unlimited plan uses the same resolver and enforcement path as future commercial plans.
