# Project Evolution

The project may be empty, partially implemented, or already contain useful data. Every session must inspect reality before following the plan.

## Evolution rules

- Preserve Git history; never rewrite or delete commits to hide changes.
- Prefer small forward migrations.
- Upgrade one major subsystem at a time.
- Replace outdated patterns through bounded slices, then remove the superseded path.
- Preserve financial identifiers, dates, snapshots, and relationships during migration.
- Reconcile ledger, subledgers, bank, VAT, stock, and projects after material data changes.
- Keep the application usable after each coherent phase.

## Before material restructuring

Create a known commit, database and file backup, migration inventory, test baseline, and explicit acceptance criteria.
