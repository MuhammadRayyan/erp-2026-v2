# AI Development Workflow

## Before work

Read all context files, inspect the branch, commits, schema, migrations, modules, tests, configuration, Docker, and runtime behavior. Correct stale context first.

## During work

- Identify the current phase and one coherent outcome.
- Research current primary sources for material framework, security, accounting, tax, and e-invoicing questions.
- Preserve route, domain, accounting, access, entitlement, audit, migration, and UI boundaries.
- Review duplicate, concurrency, stale-state, permission-change, provider-timeout, file, backup, and correction edge cases.
- Do not add optional infrastructure or features without current value.

## Verification

Use unit tests for rules, PostgreSQL integration tests for transactions and isolation, E2E tests for business workflows, accounting/VAT fixtures for reconciliation, concurrency tests for numbering/posting/stock/limits, and clean Docker checks.

If local tools cannot run a check, use GitHub Actions and record the exact result. Never claim success without evidence.

## After work

Update `PROGRESS.md`, `CHANGELOG.md`, affected plans, and `DECISIONS.md`. Keep history and create a coherent commit.
