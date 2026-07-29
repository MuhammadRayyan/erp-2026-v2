# ERP 2026 V2

A UAE-first ERP for owner-operated and small businesses, built as a structured Next.js modular monolith for technical services, automotive workshops, civil/architectural services, general services, and trading businesses.

## Current status

**Phase 4 — Accounting kernel. Completed foundations: chart of accounts, account lifecycle, accounting periods, and date locks.**

Phases 1–3 are complete. The current Phase 4 foundation provides:

- business-scoped ledger-account classes, types, normal balances, hierarchy, lifecycle, stable system keys, and required control accounts;
- deterministic UAE-oriented default charts for existing and newly onboarded businesses;
- business-scoped accounting periods with open, soft-locked, and closed states;
- PostgreSQL-enforced non-overlap, fiscal-year containment, valid transitions, date immutability after locking, and deletion prevention;
- audited create, edit, lock, close, and reopen workflows;
- a transaction-bound posting-date guard for the future journal kernel;
- accounting RBAC, entitlement enforcement, owner/accountant management, and viewer read-only behavior;
- unit, PostgreSQL integration, concurrency, browser, clean-migration, base-to-head upgrade, Docker, and booted-runtime verification.

The verified implementation-head run `30465222027`, job `90621155313`, passed every repository gate.

**No balances, opening entries, journals, document posting, VAT posting, allocation, reconciliation, or financial statements exist yet.** Financial transaction entry remains blocked until one central balanced, idempotent posting kernel with source uniqueness and linked reversals is implemented and verified.

Read `ACCOUNTING_FOUNDATION.md`, `ACCOUNTING_PERIODS.md`, `PROGRESS.md`, and `DECISIONS.md` for the active accounting boundary.

## Implemented foundations

- Next.js 16, React 19, strict TypeScript, PostgreSQL 16, and Prisma 7;
- Better Auth with PostgreSQL-backed revocable sessions;
- tenant/business isolation, RBAC, capabilities, plans, entitlements, and usage limits;
- owner onboarding, Account Hub, business workspaces, invitations, member administration, and immutable tenant access history;
- UAE business profile and VAT-registration settings;
- parties, contacts, addresses, duplicate review, products, services, units, and staged imports;
- typed custom fields, private files, business audit history, document numbering, and controlled CSV exports;
- durable PostgreSQL email outbox with a separate worker;
- chart of accounts, account lifecycle, accounting periods, and date-lock enforcement;
- Playwright verification across authentication, onboarding, master data, accounting, private files, invitations, authorization, and password recovery;
- clean-install and real base-to-head migration integrity verification;
- Docker image builds plus booted runtime/readiness/outbox smoke checks.

## Requirements

- Node.js 24 LTS;
- npm 11 or the version bundled with Node.js 24;
- Docker Desktop or Docker Engine with Compose;
- Git.

Windows development is best through WSL2 with Docker Desktop integration. Linux and macOS are supported.

## Recommended local development

### 1. Clone and configure

```bash
git clone https://github.com/MuhammadRayyan/erp-2026-v2.git
cd erp-2026-v2
cp .env.example .env
```

Generate different authentication and worker secrets of at least 32 characters:

```bash
openssl rand -base64 32
openssl rand -base64 32
```

Set different values for `BETTER_AUTH_SECRET` and `OUTBOX_WORKER_SECRET`. Never commit `.env`.

### 2. Install dependencies

```bash
npm ci
```

Use `npm ci` for reproducible installs. Use `npm install <package>` only for intentional dependency changes and commit the lockfile.

### 3. Start PostgreSQL and Mailpit

```bash
docker compose up -d db mailpit
docker compose ps
```

Local services are loopback-bound:

- PostgreSQL: `localhost:5432`
- Mailpit UI: `http://localhost:8025`
- Mailpit SMTP: `localhost:1025`

### 4. Generate and migrate

```bash
npm run db:generate
npm run db:deploy
```

When intentionally creating a migration:

```bash
npm run db:migrate -- --name meaningful_migration_name
```

Never use `prisma db push` as the normal workflow and never edit a migration that has already been shared or applied.

### 5. Start the web application and worker

Terminal one:

```bash
npm run dev
```

Terminal two:

```bash
npm run worker:email
```

Open:

- ERP: `http://localhost:3000`
- Mailpit: `http://localhost:8025`

The worker is required because invitation and password-reset requests persist delivery work before returning.

## Full Docker mode

```bash
cp .env.example .env
docker compose up --build
```

Compose starts PostgreSQL, applies migrations, starts Mailpit, waits for database-aware web readiness, starts the email worker, and mounts private files at `/app/storage/private`.

Stop without deleting data:

```bash
docker compose down
```

Delete local PostgreSQL and private-file volumes only for an intentional reset:

```bash
docker compose down -v
```

`-v` permanently removes both local datasets.

## Environment contract

| Variable | Required | Local example | Purpose |
|---|---:|---|---|
| `DATABASE_URL` | Yes | `postgresql://erp:erp@localhost:5432/erp` | Application and Prisma database |
| `BETTER_AUTH_SECRET` | Yes | generated value | Authentication secret, minimum 32 characters |
| `BETTER_AUTH_URL` | Yes | `http://localhost:3000` | Better Auth origin |
| `APP_URL` | Yes | `http://localhost:3000` | Canonical/trusted application origin |
| `SMTP_HOST` | For delivery | `localhost` | SMTP host |
| `SMTP_PORT` | No | `1025` | SMTP port |
| `SMTP_SECURE` | No | `false` | Implicit SMTP TLS |
| `SMTP_USER` | No | empty | SMTP username |
| `SMTP_PASSWORD` | No | empty | SMTP password |
| `EMAIL_FROM` | No | `ERP 2026 <no-reply@localhost>` | Platform sender |
| `OUTBOX_WORKER_SECRET` | For delivery | generated value | Protects internal outbox processing |
| `OUTBOX_BATCH_SIZE` | No | `10` | Messages claimed per worker request |
| `OUTBOX_POLL_SECONDS` | No | `5` | Worker polling interval |
| `FILE_STORAGE_PROVIDER` | For files | `local` | Private storage adapter |
| `FILE_STORAGE_ROOT` | For local files | `./storage/private` | Non-public object directory |
| `FILE_MAX_BYTES` | No | `10485760` | Upload limit; hard maximum 50 MiB |

In Compose, PostgreSQL is `db`, Mailpit is `mailpit`, the worker calls `web`, and private files use `/app/storage/private`.

## Accounting foundation

The Accounting workspace currently manages structure and date control only.

- `accounting.view` reads the chart and period register.
- `accounting.manage` administers accounts and periods.
- `accounting.core` must be enabled for the tenant.
- Viewer roles are read-only.
- Every meaningful account/period change creates a business audit event.
- Required system controls cannot be deactivated.
- Account hierarchy and classification are protected by PostgreSQL and service rules.
- Periods cannot overlap, cross one fiscal-year boundary, or be deleted.
- Soft-locked and closed periods reject the future posting guard.
- Fiscal-year start cannot change through ordinary settings after periods exist.
- There is no journal or financial-document posting path yet.

See `ACCOUNTING_FOUNDATION.md` and `ACCOUNTING_PERIODS.md`.

## Tenant access history

The tenant users-and-access page records invitation, membership, business-role/status, and administration-driven session changes. Events are tenant-scoped, transactional, owner-readable after `users.manage`, and protected by a PostgreSQL trigger that rejects updates and deletes. Audit metadata excludes passwords, secrets, tokens, links, sessions, and email bodies.

See `TENANT_ACCESS_AUDIT.md`.

## Database and migration integrity

Common commands:

```bash
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:status
npm run db:verify-integrity
npm run db:studio
```

For a migrated disposable database:

```bash
npm run db:status
npx prisma migrate diff \
  --from-schema prisma \
  --to-config-datasource \
  --script \
  --exit-code
npm run db:verify-integrity
```

The integrity gate protects approved composite tenant keys, checks, custom indexes, triggers/functions, and required extensions. Pull-request CI also builds a second database from the exact base commit, inserts representative data, applies head migrations, and verifies schema integrity and data preservation. Accounting-period objects have a focused catalog verifier in addition to the general manifest.

Migration rules:

- use new forward migrations;
- inspect generated and custom SQL;
- map existing database object names in Prisma where supported;
- update integrity checks only for intentional reviewed invariant changes;
- verify clean installation and base-to-head upgrade;
- back up important data before destructive changes.

See `MIGRATION_INTEGRITY.md`.

## Backups and restore

PostgreSQL metadata and private objects form one logical dataset. Pending outbox records may contain temporary invitation or reset links, so database backups are sensitive.

Host backup:

```bash
mkdir -p backups
pg_dump "$DATABASE_URL" --format=custom --file="backups/erp-$(date +%Y%m%d-%H%M%S).dump"
tar -czf "backups/private-files-$(date +%Y%m%d-%H%M%S).tar.gz" storage/private
```

Docker backup:

```bash
mkdir -p backups
docker compose exec -T db pg_dump -U erp -d erp --format=custom > "backups/erp-$(date +%Y%m%d-%H%M%S).dump"
docker run --rm -v erp-2026-v2_private_files:/data -v "$PWD/backups:/backup" alpine sh -c 'tar -czf /backup/private-files.tar.gz -C /data .'
```

Confirm the actual volume name with `docker volume ls`.

Restore order:

1. stop the worker and application writes;
2. restore PostgreSQL;
3. restore the matching private-file archive;
4. run `npm run db:deploy` and migration-integrity checks;
5. review pending/retry outbox records and expiry dates;
6. start the web service, then the worker;
7. verify health, accounting structure, periods, files, audit history, tenant access history, and delivery.

Never restore the database and private files from different maintenance windows. Test restoration on a disposable environment.

## Verification

Unit and integration gates:

```bash
npm run test
docker compose up -d db
npm run db:deploy
npm run test:integration
```

Browser E2E:

```bash
npx playwright install chromium
docker compose up -d db mailpit
npm run db:deploy
npm run build
npm run test:e2e
```

Playwright starts the production web process and email worker. It verifies anonymous denial, sign-up, onboarding, parties, catalog, chart accounts, accounting periods and transitions, owner/viewer authorization, private files, invitation delivery/acceptance, tenant access history, password reset, session revocation, and reauthentication. Never point tests at production or valuable data.

Standard local gate:

```bash
npm run verify
npm run test:e2e
```

GitHub Actions additionally enforces migration status, supported schema diff, PostgreSQL catalog integrity, real base-to-head upgrade preservation, browser E2E, Compose validation, migration/runtime images, runtime boot, database readiness, and protected outbox processing.

## Health and troubleshooting

Readiness endpoint:

```text
GET /api/health
```

It returns `200` only when PostgreSQL is reachable; database failure returns `503`.

Useful logs:

```bash
docker compose logs -f db
docker compose logs -f migrate
docker compose logs -f web
docker compose logs -f worker
docker compose logs -f mailpit
```

Common checks:

- database failure: confirm `db` is healthy and use `localhost`, not `db`, for host development;
- authentication/origin failure: align `BETTER_AUTH_URL`, `APP_URL`, and the browser origin;
- queued email: run the worker and confirm SMTP plus `OUTBOX_WORKER_SECRET`;
- migration integrity: inspect migration status, schema diff, and named catalog object rather than weakening the gate;
- browser E2E: inspect `playwright-report/` and `test-results/`;
- stale Prisma client: run `npm run db:generate`.

## Project structure

```text
prisma/                       Multi-file schema and ordered migrations
scripts/                      Workers and verification utilities
src/app/                      Next.js routes, layouts, and HTTP handlers
src/components/               Shared UI and forms
src/lib/                      Infrastructure configuration and adapters
src/modules/                  Domain and application modules
tests/                        Unit, PostgreSQL integration, and Playwright E2E
.github/workflows/            CI verification
*.md                          Durable architecture and operations context
```

Route handlers remain thin. Domain modules own authorization, business rules, transactions, and tests.

## Development workflow

1. Read the context files and relevant operating guide.
2. Verify branch, history, schema, migrations, code, and tests.
3. Implement one coherent slice.
4. Add reviewed forward migrations when needed.
5. Run relevant local checks or GitHub Actions.
6. Require clean migration, application, browser, Docker, and runtime evidence before merge.
7. Merge normally without rewriting history.
8. Update context only after claims are supported by executable evidence.

## Context reading order

1. `PROJECT_PLAN.md`
2. `IMPLEMENTATION_BASELINE.md`
3. `MODULES_AND_PHASES.md`
4. `INDUSTRY_WORKFLOWS.md`
5. `SECURITY_COMPLIANCE.md`
6. `PROJECT_EVOLUTION.md`
7. `AI_WORKFLOW.md`
8. `PHASE_3_VERIFICATION_AUDIT.md`
9. `PROGRESS.md`
10. `DECISIONS.md`
11. `CHANGELOG.md`
12. `FUTURE_DEVELOPMENTS.md`
13. `RESEARCH_REFERENCES.md`

Use `ACCOUNTING_FOUNDATION.md`, `ACCOUNTING_PERIODS.md`, `MIGRATION_INTEGRITY.md`, `TENANT_ACCESS_AUDIT.md`, `E2E_TESTING.md`, and `OUTBOX_OPERATIONS.md` for their respective boundaries.

The repository, migrations, tests, and verified runtime behavior are the source of truth. Documentation must not overstate implementation.

## Continuation prompt

> Read all context files in order. Treat progress and changelog statements as claims to verify against code, migrations, tests, Git history, browser evidence, Docker configuration, and runtime behavior. Correct stale context before continuing. Complete the highest-priority hardening or implementation slice while preserving accounting integrity, tenant/business isolation, RBAC, entitlements, migration safety, concurrency controls, tests, UI consistency, backups, and documentation.
