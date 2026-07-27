# ERP 2026 V2

A structured UAE-first ERP for owner-operated and small businesses. The initial product targets technical services, automotive workshops, civil/architectural services, and general service/trading workflows.

## Current status

Phase 1 foundation is in progress. The repository now contains the target route boundaries, shared UI shell, module registry, initial tenancy schema, Docker configuration, CI workflow, and durable project context.

## Local foundation

Requirements:

- Node.js 24 LTS
- npm
- Docker with Compose

Create `.env` from `.env.example`, then install dependencies and run the application. PostgreSQL can be started through `compose.yaml`.

## Verification

The standard verification command is:

`npm run verify`

GitHub Actions runs Prisma generation, linting, type checking, unit tests, and a production build on pushes and pull requests.

## Context reading order

1. `PROJECT_PLAN.md`
2. `IMPLEMENTATION_BASELINE.md`
3. `MODULES_AND_PHASES.md`
4. `INDUSTRY_WORKFLOWS.md`
5. `SECURITY_COMPLIANCE.md`
6. `PROJECT_EVOLUTION.md`
7. `AI_WORKFLOW.md`
8. `PROGRESS.md`
9. `DECISIONS.md`
10. `CHANGELOG.md`
11. `FUTURE_DEVELOPMENTS.md`
12. `RESEARCH_REFERENCES.md`

The repository and verified runtime behavior are the source of truth. Context files describe the target direction and must be updated after meaningful work.

## Minimal continuation prompt

> Read all project context Markdown files in their stated order. Inspect the repository, branch, Git history, schema, migrations, tests, and running behavior. Correct stale context before continuing. Proceed with the highest-priority incomplete phase while preserving accounting integrity, tenant and business isolation, RBAC, entitlements, migrations, tests, consistent UI patterns, backups, and documentation.
