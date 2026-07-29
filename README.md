# ERP 2026 V2

A UAE-first ERP for owner-operated and small businesses, built as a structured Next.js modular monolith for technical services, automotive workshops, civil/architectural services, general services, and trading businesses.

## Current status

**Phase 4 — Accounting kernel. Active slice: chart of accounts and account lifecycle.**

Phases 1–3 are complete. PR #26 adds the first accounting structure without introducing financial transactions:

- business-scoped account classes, constrained types, normal balances, contra accounts, headers, posting accounts, and control accounts;
- tenant-safe hierarchy, stable system keys, required controls, and active/inactive lifecycle;
- deterministic UAE-oriented default chart for existing and newly onboarded businesses;
- accounting RBAC, entitlement enforcement, protected register/detail UI, and business audit events;
- PostgreSQL classification and hierarchy invariants;
- clean-install, base-to-head upgrade, PostgreSQL, browser, Docker, and runtime verification.

The implementation-head PR #26 run `30442778259`, job `90545780793`, passed every repository gate. The next slice is accounting periods and locks.

**No balances, opening entries, journals, document posting, VAT posting, allocation, reconciliation, or financial statements exist yet.** Transaction entry remains blocked until period enforcement and one balanced, idempotent posting kernel with reversals are implemented and PostgreSQL integration-tested.

Read `ACCOUNTING_FOUNDATION.md`, `PROGRESS.md`, and `DECISIONS.md` for the active accounting boundary.

## Implemented foundations

- Next.js 16, React 19, strict TypeScript, PostgreSQL 16, and Prisma 7;
- Better Auth with PostgreSQL-backed revocable sessions;
- tenant/business isolation, RBAC, capabilities, plans, entitlements, and usage limits;
- owner onboarding, Account Hub, business workspaces, invitations, member administration, and immutable tenant access history;
- UAE business profile and VAT-registration settings;
- parties, contacts, addresses, duplicate review, products, services, units, and staged imports;
- typed custom fields, private files, business audit history, document numbering, and controlled CSV exports;
- durable PostgreSQL email outbox with a separate worker;
- chart of accounts and account lifecycle structure;
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

Generate separate authentication and worker secrets of at least 32 characters:

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

## Accounting structure

The Accounting workspace currently manages chart structure only.

- `accounting.view` reads the chart.
- `accounting.manage` creates, edits, activates, and deactivates accounts.
- `accounting.core` must be enabled for the tenant.
- Viewer roles are read-only.
- Create/update/status changes produce business audit events.
- Required system controls cannot be deactivated.
- System-managed classification and hierarchy are immutable; code, name, and description may be localized while `systemKey` remains stable.
- Header parents must be active, same-class, and in the same business.
- PostgreSQL rejects cycles and invalid class/type/balance/kind combinations.
- There is no hard-delete path.

See `ACCOUNTING_FOUNDATION.md` for the default chart, lifecycle, hierarchy, migration, and explicit non-posting rules.

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

The catalog verifier protects approved composite tenant keys, business checks, custom indexes, triggers/functions, and required extensions. Pull-request CI also builds a second database from the exact base commit, inserts representative data, applies head migrations, and verifies both schema integrity and data preservation. PR #26 additionally verifies default-chart backfill during this real upgrade.

Migration rules:

- use new forward migrations;
- inspect generated and custom SQL;
- map existing database object names in Prisma where supported;
- update the catalog manifest only for intentional reviewed invariant changes;
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
7. verify health, chart structure, files, audit history, tenant access history, and delivery.

Never restore the database and private files from different maintenance windows. Test restoration on a disposable environment.

## Verification

Unit tests:

```bash
npm run test
```

PostgreSQL integration tests:

```bash
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

Playwright starts the production web process and email worker. It verifies anonymous denial, sign-up, onboarding, parties, catalog, default/custom chart accounts, owner/viewer accounting authorization, private files, invitation delivery/acceptance, tenant access history, password reset, session revocation, and reauthentication. Never point tests at production or valuable data. See `E2E_TESTING.md`.

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

### Database connection failure

- confirm `db` is healthy;
- use `localhost`, not `db`, for host development;
- confirm port `5432` is available.

### Authentication/origin failure

- confirm `BETTER_AUTH_SECRET` is at least 32 characters;
- keep `BETTER_AUTH_URL`, `APP_URL`, and the browser origin identical;
- restart after environment changes.

### Queued email is not delivered

- start `npm run worker:email` during host development;
- ensure the application and worker use the same `OUTBOX_WORKER_SECRET`;
- verify Mailpit or the configured SMTP provider is reachable.

### Migration integrity fails

- run `npm run db:status`;
- inspect the Prisma diff;
- review the named missing or changed catalog object;
- fix the migration/schema relationship rather than weakening the manifest.

### Browser E2E fails

- install Chromium;
- confirm PostgreSQL and Mailpit are running;
- build the production application;
- keep application origins aligned;
- inspect `playwright-report/` and `test-results/`.

### Stale Prisma client

```bash
npm run db:generate
```

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

Use `ACCOUNTING_FOUNDATION.md`, `MIGRATION_INTEGRITY.md`, `TENANT_ACCESS_AUDIT.md`, `E2E_TESTING.md`, and `OUTBOX_OPERATIONS.md` for their respective boundaries.

The repository, migrations, tests, and verified runtime behavior are the source of truth. Documentation must not overstate implementation.

## Continuation prompt

> Read all context files in order. Treat progress and changelog statements as claims to verify against code, migrations, tests, Git history, browser evidence, Docker configuration, and runtime behavior. Correct stale context before continuing. Complete the highest-priority hardening or implementation slice while preserving accounting integrity, tenant/business isolation, RBAC, entitlements, migration safety, concurrency controls, tests, UI consistency, backups, and documentation.