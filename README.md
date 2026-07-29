# ERP 2026 V2

A structured UAE-first ERP for owner-operated and small businesses. The product is being developed phase by phase for technical services, automotive workshops, civil/architectural services, and general service or trading businesses.

## Current project status

Phase 3 — Verification and hardening.

Implemented foundations include:

- Next.js 16 App Router and React 19;
- PostgreSQL 16 and Prisma 7;
- Better Auth with database-backed sessions;
- tenant and business isolation;
- explicit owner onboarding;
- authenticated Account Hub and business workspaces;
- tenant access administration and secure invitations;
- business roles, capabilities, plans, entitlements, and usage limits;
- business profile and UAE VAT registration settings;
- shared customer and supplier parties with contacts, addresses, and duplicate review;
- products, services, units, lifecycle controls, and staged imports;
- typed custom fields for parties and catalog items;
- private files, attachment links, audit history, and coordinated backup guidance;
- reusable document numbering and immutable allocation history;
- controlled filtered CSV exports with checksums and audit history;
- durable PostgreSQL queued email with a separate worker;
- Docker and GitHub Actions verification.

These foundations are under evidence-based hardening before Phase 4 begins. See `PHASE_3_VERIFICATION_AUDIT.md` and `PROGRESS.md` for confirmed strengths, defects, verification gaps, and the active plan.

## Technology requirements

Install these before running the project locally:

- Node.js 24 LTS;
- npm 11 or the npm version bundled with Node.js 24;
- Docker Desktop or Docker Engine with Docker Compose;
- Git.

Windows development is best through WSL2 with Docker Desktop integration, although the project also works directly on Linux and macOS.

## First-time setup — recommended local development

This mode runs PostgreSQL and Mailpit in Docker while Next.js and the email worker run directly on the host. It provides the fastest hot reload and does not rebuild a container after each code change.

### 1. Clone the repository

```bash
git clone https://github.com/MuhammadRayyan/erp-2026-v2.git
cd erp-2026-v2
```

### 2. Create the environment file

```bash
cp .env.example .env
```

Generate separate authentication and worker secrets of at least 32 characters:

```bash
openssl rand -base64 32
openssl rand -base64 32
```

Replace `BETTER_AUTH_SECRET` and `OUTBOX_WORKER_SECRET` in `.env` with different generated values. Never commit `.env`.

### 3. Install dependencies

```bash
npm ci
```

Use `npm ci` for a clean reproducible installation. Use `npm install <package>` only when intentionally changing dependencies and commit the resulting lockfile.

### 4. Start local infrastructure

```bash
docker compose up -d db mailpit
```

Services are bound to the local machine only:

- PostgreSQL: `localhost:5432`
- Mailpit web interface: `http://localhost:8025`
- Mailpit SMTP: `localhost:1025`

Check service health:

```bash
docker compose ps
```

### 5. Generate Prisma Client

```bash
npm run db:generate
```

### 6. Apply database migrations

For normal first-time setup or a shared branch:

```bash
npm run db:deploy
```

When intentionally creating a new migration during development:

```bash
npm run db:migrate -- --name meaningful_migration_name
```

Do not use `prisma db push` as the normal project workflow. Schema changes must be represented by reviewed migrations.

### 7. Start the application

```bash
npm run dev
```

### 8. Start queued email processing

In a second terminal:

```bash
npm run worker:email
```

The application creates invitation and password-reset records durably. The worker is required to deliver those records to Mailpit or the configured SMTP provider.

Open `http://localhost:3000` and Mailpit at `http://localhost:8025`.

Create an account, create the first tenant and business through onboarding, and enter the business workspace from the Account Hub.

## Full Docker setup

This mode builds and runs the complete application stack. It is useful for clean-environment verification and deployment-like testing.

```bash
cp .env.example .env
docker compose up --build
```

Docker Compose will:

1. start PostgreSQL and wait for database health;
2. apply committed Prisma migrations once;
3. start Mailpit for local email inspection;
4. start the application and wait for database-aware readiness;
5. start the queued-email worker only after the application is ready;
6. mount a private file volume at `/app/storage/private`.

Open:

- ERP: `http://localhost:3000`
- Mailpit: `http://localhost:8025`

PostgreSQL and Mailpit ports are loopback-bound and are not exposed on external host interfaces. A remote deployment should place the web application behind HTTPS and should not publish database, Mailpit, or worker endpoints.

Stop services without deleting data:

```bash
docker compose down
```

Stop services and permanently remove the local PostgreSQL and private-file volumes only when a full reset is intentional:

```bash
docker compose down -v
```

**Warning:** `-v` deletes both the local database and private-file volume.

## Environment variables

| Variable | Required | Local example | Purpose |
|---|---:|---|---|
| `DATABASE_URL` | Yes | `postgresql://erp:erp@localhost:5432/erp` | PostgreSQL connection used by Prisma and the application |
| `BETTER_AUTH_SECRET` | Yes | Generated private value | Signs and protects authentication data; minimum 32 characters |
| `BETTER_AUTH_URL` | Yes | `http://localhost:3000` | Better Auth base URL |
| `APP_URL` | Yes | `http://localhost:3000` | Canonical application origin and trusted browser origin |
| `SMTP_HOST` | No initially | `localhost` | SMTP server used by the queued-email processor |
| `SMTP_PORT` | No initially | `1025` | SMTP port |
| `SMTP_SECURE` | No initially | `false` | Use implicit TLS for SMTP |
| `SMTP_USER` | No | empty | SMTP username |
| `SMTP_PASSWORD` | No | empty | SMTP password |
| `EMAIL_FROM` | No initially | `ERP 2026 <no-reply@localhost>` | Platform identity sender |
| `OUTBOX_WORKER_SECRET` | Yes for delivery | Generated private value | Protects the internal outbox-processing endpoint; minimum 32 characters |
| `OUTBOX_BATCH_SIZE` | No | `10` | Maximum messages claimed per worker request; capped by the application |
| `OUTBOX_POLL_SECONDS` | No | `5` | Delay between worker processing requests |
| `FILE_STORAGE_PROVIDER` | Yes for files | `local` | Private object-storage adapter; local is implemented, S3 is reserved |
| `FILE_STORAGE_ROOT` | Yes for local files | `./storage/private` | Non-public private storage directory |
| `FILE_MAX_BYTES` | No | `10485760` | Maximum accepted upload size in bytes; hard maximum is 50 MiB |

For Docker Compose, service-to-service hostnames differ from host development: PostgreSQL is `db`, Mailpit is `mailpit`, the worker calls `web`, and private files use `/app/storage/private`. Compose supplies those values to containers.

See `OUTBOX_OPERATIONS.md` for delivery lifecycle, retries, payload retention, failure handling, and secret rotation.

## Database commands

```bash
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:studio
```

Migration rules:

- never edit a migration that has already been shared or applied;
- add a new forward migration instead;
- inspect generated SQL before committing;
- commit schema and migration together;
- run integration tests after every structural database change;
- back up important local or hosted data before destructive changes.

## Backups and restore

PostgreSQL metadata and private file objects form one logical dataset. Back up and restore them as a coordinated pair from the same maintenance window. Pending outbox records can contain temporary invitation or password-reset links, so database backups are sensitive.

### Host-development backup

```bash
mkdir -p backups
pg_dump "$DATABASE_URL" --format=custom --file="backups/erp-$(date +%Y%m%d-%H%M%S).dump"
tar -czf "backups/private-files-$(date +%Y%m%d-%H%M%S).tar.gz" storage/private
```

### Docker backup

```bash
mkdir -p backups
docker compose exec -T db pg_dump -U erp -d erp --format=custom > "backups/erp-$(date +%Y%m%d-%H%M%S).dump"
docker run --rm -v erp-2026-v2_private_files:/data -v "$PWD/backups:/backup" alpine sh -c 'tar -czf /backup/private-files.tar.gz -C /data .'
```

Confirm the actual Compose volume name with `docker volume ls`; Compose may prefix it with the checkout directory name.

### Restore rules

1. stop the worker and application writes;
2. restore PostgreSQL to the intended database;
3. restore the matching private-file archive into `FILE_STORAGE_ROOT` or the Docker private-files volume;
4. run `npm run db:deploy`;
5. review pending/retry outbox records and their expiry timestamps;
6. start the application, then the worker;
7. verify health, file downloads, recent audit history, and email delivery.

Never restore a database dump without its matching private-file archive. Never restore private files alone over newer database metadata. Test restoration periodically on a disposable environment.

## Running tests and verification

### Unit tests

```bash
npm run test
```

### PostgreSQL integration tests

```bash
docker compose up -d db
npm run db:deploy
npm run test:integration
```

Integration tests use the configured `DATABASE_URL`. Do not point tests at a production or valuable database.

### Watch mode

```bash
npm run test:watch
```

### Individual quality checks

```bash
npm run lint
npm run typecheck
npm run build
```

### Complete local verification

```bash
npm run verify
```

The full verification requires a reachable migrated PostgreSQL database and runs lint, TypeScript checking, unit tests, PostgreSQL integration tests, and the production build. GitHub Actions also validates Compose configuration and both migration/runtime Docker image targets.

Browser E2E and a booted full-stack smoke gate are tracked in `PHASE_3_VERIFICATION_AUDIT.md` and must be added before Phase 3 is finally closed.

## Health and troubleshooting

Application readiness endpoint:

```text
GET /api/health
```

It returns `200` only when the web process can reach PostgreSQL; database failure returns `503`.

Useful commands:

```bash
docker compose ps
docker compose logs -f db
docker compose logs -f web
docker compose logs -f worker
docker compose logs -f migrate
docker compose logs -f mailpit
```

Common problems:

### PostgreSQL connection refused

- confirm `docker compose ps` shows `db` as healthy;
- confirm host development uses `localhost`, not `db`, in `DATABASE_URL`;
- confirm port `5432` is not occupied by another local PostgreSQL instance.

### Authentication configuration error

- confirm `BETTER_AUTH_SECRET` is at least 32 characters;
- confirm `BETTER_AUTH_URL` and `APP_URL` match the URL opened in the browser;
- restart the development server after changing `.env`.

### Invitations or password resets remain queued

- confirm `OUTBOX_WORKER_SECRET` is the same for the application and worker;
- run `npm run worker:email` during host development;
- inspect `docker compose logs -f worker` in full Docker mode;
- confirm Mailpit or the configured SMTP server is reachable.

### Prisma Client missing or stale

```bash
npm run db:generate
```

Restart the development server afterward.

### Database schema is behind

```bash
npm run db:deploy
```

### Clean dependency reinstall

```bash
rm -rf node_modules .next
npm ci
npm run db:generate
```

## Project structure

```text
prisma/                       Database schema and ordered migrations
src/app/                      Next.js routes, layouts, and HTTP handlers
src/components/               Shared UI and layout components
src/lib/                      Infrastructure configuration and adapters
src/modules/                  Domain and application modules
tests/                        Unit and PostgreSQL integration tests
.github/workflows/            CI verification
*.md                          Durable product and development context
```

Route handlers remain thin. Domain modules own business rules, authorization, transactions, and tests.

## Development workflow

1. Read `PROGRESS.md`, `PHASE_3_VERIFICATION_AUDIT.md`, and the relevant phase.
2. Inspect the current branch, migrations, tests, configuration, and verified runtime evidence.
3. Create one coherent implementation slice.
4. Update or add forward migrations when needed.
5. Run relevant local checks or the GitHub Actions gate when local execution is unavailable.
6. Open a pull request and require the full CI gate to pass.
7. Merge without rewriting or deleting history.
8. Update context files only after claims are supported by code and test evidence.

## Project context reading order

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

The repository, migrations, tests, and verified runtime behavior are the source of truth. Context files describe accepted direction and must not overstate implementation.

## Continuation prompt

> Read all project context Markdown files in their stated order. Treat progress and changelog claims as items to verify against code, migrations, tests, Git history, Docker configuration, and runtime evidence. Correct stale context before continuing. Complete the highest-priority hardening or implementation slice while preserving accounting integrity, tenant and business isolation, RBAC, entitlements, migrations, concurrency controls, tests, consistent UI patterns, backups, and documentation.
