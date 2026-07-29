# Migration Integrity and Upgrade Verification

## Purpose

PostgreSQL is the system of record. Prisma provides typed models and ordered migrations, but not every production invariant is representable in the Prisma schema. The project therefore verifies four independent sources of migration truth:

1. committed migration history;
2. the Prisma schema for supported objects;
3. a PostgreSQL catalog manifest for custom or critical objects;
4. a base-to-head upgrade with preserved representative data.

A migration change is not accepted merely because `prisma migrate deploy` succeeds.

## Clean-database gate

After applying all migrations to a clean PostgreSQL database, CI requires:

```bash
npm run db:status
npx prisma migrate diff \
  --from-schema prisma \
  --to-config-datasource \
  --script \
  --exit-code
npm run db:verify-integrity
```

The checks mean:

- migration history is complete and has no failed, missing, or divergent records;
- the Prisma schema and migrated database have no differences for objects Prisma supports;
- critical PostgreSQL objects that Prisma cannot fully describe still match the approved manifest.

## Catalog manifest

`scripts/verify-migration-integrity.mjs` reads PostgreSQL system catalogs and fails when an approved invariant is missing or weakened.

The current manifest verifies:

- 26 composite foreign keys that preserve tenant/business scope and reference the intended composite keys;
- delete and update actions plus validation state for those keys;
- 34 business and data-integrity check constraints;
- the party trigram GIN index and `pg_trgm` extension;
- one-primary-contact and one-default-address partial unique indexes;
- the custom-field target-validation trigger and its PL/pgSQL function.

The manifest complements Prisma drift detection. It is not a replacement for modeling supported relations and indexes in Prisma.

## Prisma relation reconciliation

Existing database foreign keys, relation names, unique keys, and indexes should be represented in the multi-file Prisma schema whenever Prisma supports them. Use `map:` to preserve reviewed database names rather than allowing generated migrations to rename objects or create simpler duplicate foreign keys.

PostgreSQL-specific objects remain in reviewed SQL migrations and the catalog manifest, including:

- check constraints whose full logic is not represented in Prisma models;
- partial unique indexes;
- trigger functions and triggers;
- required extensions;
- operator-class details that require explicit PostgreSQL handling.

## Base-to-head upgrade gate

For every pull request, CI checks out the exact target branch commit into a separate worktree and creates a second database.

The gate then:

1. installs the base commit dependencies;
2. generates its Prisma client;
3. deploys the base commit migrations;
4. inserts stable representative records for a user, owner membership, tenant, business, unit, and party;
5. applies the pull request migrations using the head code;
6. requires current migration status;
7. requires an empty supported-object schema diff;
8. re-runs the PostgreSQL catalog manifest;
9. confirms the representative record graph and values were preserved.

The implementation is in:

- `scripts/verify-migration-upgrade.sh`;
- `scripts/migration-upgrade-fixture.mjs`.

The second database is disposable and must never point to production or valuable data.

## Local checks

Start a disposable PostgreSQL instance and apply migrations:

```bash
docker compose up -d db
npm ci
npm run db:generate
npm run db:deploy
```

Run the clean integrity checks:

```bash
npm run db:status
npx prisma migrate diff \
  --from-schema prisma \
  --to-config-datasource \
  --script \
  --exit-code
npm run db:verify-integrity
```

The base-to-head script is mainly intended for pull-request CI because it requires the target commit SHA and a second database URL. It can be run locally only in a disposable repository checkout and database:

```bash
BASE_SHA=<target-branch-commit> \
UPGRADE_DATABASE_URL=postgresql://erp:erp@localhost:5432/erp_upgrade \
bash scripts/verify-migration-upgrade.sh
```

## Changing the database safely

When adding or changing a database invariant:

1. update the Prisma model when the object is supported;
2. create a new forward migration;
3. inspect the generated and custom SQL;
4. preserve established object names with `map:` where appropriate;
5. update the catalog manifest when a reviewed PostgreSQL-specific invariant intentionally changes;
6. add transaction, tenant-isolation, or correction-flow tests for the affected behavior;
7. verify both clean installation and base-to-head upgrade;
8. update the architecture decision, changelog, audit, and progress records only after executable evidence passes.

Never edit an already shared migration, use `prisma db push` as the normal workflow, or weaken the catalog manifest solely to clear CI.

## Failure interpretation

### Migration status failure

The migrations folder and `_prisma_migrations` history disagree, a migration failed, or pending migrations were not deployed.

### Prisma diff failure

The supported Prisma schema does not match the migrated database. Typical causes are an unmodeled foreign key, missing `map:` name, unintended index, or a schema edit without a migration.

### Catalog manifest failure

A critical composite key, business check, partial index, trigger/function, or required extension is missing or has changed. Review the migration and invariant before changing the manifest.

### Upgrade failure

The pull request cannot upgrade the actual base schema safely, leaves drift after upgrade, weakens the catalog manifest, or damages representative data. Fix the migration rather than relying on clean-install success.
