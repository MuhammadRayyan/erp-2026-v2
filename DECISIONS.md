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

## ADR-010 — Duplicate review precedes party merging

**Status:** Accepted

Detect possible duplicate parties using tenant-scoped exact identifiers and PostgreSQL name similarity. Persist review evidence and explicit confirmed/dismissed decisions, but never merge, delete, or reassign references automatically. A future merge workflow must define a surviving party, preserve source identifiers and snapshots, move references transactionally, retain an audit trail, and remain reversible where financial records are involved.

## ADR-011 — Catalog defaults are classifications, not postings

**Status:** Accepted

Items and services may store exact default prices plus preparatory account-class and tax-category keys before the accounting and VAT kernels exist. These defaults never create journal entries, determine statutory VAT by themselves, or bypass document-time validation. Future sales and purchase documents must snapshot the resolved classifications and pass them through the central accounting and VAT engines.

## ADR-012 — Private objects remain outside PostgreSQL and the public web root

**Status:** Accepted

Store file metadata, attachment scope, hashes, and audit events in PostgreSQL while storing binary objects through a private adapter. Local development and Docker use a non-public local volume; a future S3-compatible adapter must preserve the same keys and authorization boundary. Uploads require allowlisted extensions and MIME types, byte-signature checks, size limits, generated opaque keys, and tenant/business authorization. Database and private-object backups must be created and restored as one coordinated dataset.

## ADR-013 — Number allocations are locked, idempotent, and immutable

**Status:** Accepted

Each business owns explicit document sequences. A future business document must allocate its identifier inside the same PostgreSQL transaction that creates the document, after the calling module has enforced its own authorization. Allocation and settings updates lock the same sequence row. A stable idempotency key may be reused only with the same effective date and reference. Reset policy and start value become immutable after the first allocation because changing either can silently restart a sequence; labels, activation, padding, and formatting may affect only future allocations. Voids lock the allocation row, retain history, and never reuse an identifier. Direct administration remains protected by business settings permissions and audit events.

## ADR-014 — Small exports are synchronous, bounded, and not retained

**Status:** Accepted

Generate current master-data exports synchronously because the initial deployment serves one owner or a small trusted team. Every export requires a dedicated export capability, the dataset's normal view permission, and the tenant export entitlement. Dataset adapters own explicit filter schemas and deterministic columns. CSV generation must neutralize spreadsheet formulas, use a hard row ceiling, fail rather than truncate, and return a private non-cacheable response. PostgreSQL stores only immutable run metadata, filters, actor, row count, file name, checksum, and audit event; generated CSV payloads are not retained. Move large or scheduled exports to the PostgreSQL outbox worker only after measured volume requires asynchronous processing.

## ADR-015 — Custom fields use typed columns and module-owned permissions

**Status:** Accepted

Custom-field definitions are business-scoped and identify an immutable target entity, stable key, and immutable value type. Operational values use dedicated text, decimal, date, and boolean columns rather than arbitrary JSON. PostgreSQL composite keys bind each value to the definition's tenant, business, entity type, and value type, while target validation prevents cross-tenant or nonexistent owners. Definition administration requires business-settings management; reading and editing values reuse the owning module's normal view and manage capabilities. Required fields are enforced when values are saved. Select options already used by records cannot be removed, preserving historical meaning. Deactivation hides a field without deleting its stored values, and all definition/value changes create audit events.

## ADR-016 — Email delivery uses a durable PostgreSQL outbox

**Status:** Accepted

Invitation and password-reset emails are written to PostgreSQL before request completion. Invitation creation and its delivery record share one transaction. Workers claim bounded batches with `FOR UPDATE SKIP LOCKED`, recover stale locks, apply bounded exponential retries, respect expiry, and record provider identifiers or terminal errors. Idempotency keys accept only equivalent payloads. Older queued password resets are cancelled when a new reset is requested. Claimed invitation messages recheck that their invitation is still pending and unexpired immediately before SMTP delivery. Message bodies containing invitation or reset links are scrubbed after sent, failed, expired, or cancelled outcomes while delivery metadata remains available for operations. SMTP remains at-least-once because PostgreSQL cannot share a transaction with the provider.

## ADR-017 — Phase completion requires independent evidence

**Status:** Accepted

A phase is not complete because `PROGRESS.md`, a changelog entry, or a merged pull request says so. Completion requires code and migration review against the authoritative roadmap, regression coverage for authorization, tenant isolation, concurrency, stale state, correction flows, setup, and deployment boundaries, plus a clean executable verification gate. Known defects or missing mandatory test layers must keep the phase open or be explicitly accepted as deferred with a safe boundary. Documentation-only phase transitions do not constitute verification.
