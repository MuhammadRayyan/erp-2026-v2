# Controlled Opening Balances

This guide defines the initial Phase 4 opening-balance backend boundary. Opening balances are not an ordinary manual journal workflow. They are a controlled business cutover posting that uses the central accounting kernel.

## Scope

The initial service accepts one opening-balance set for a business and posts it as one journal through `postJournalEntry`.

The request contains:

- a cutover accounting date;
- a stable idempotency key;
- optional memo;
- one or more one-sided opening lines.

The service reads the business base currency, validates the requested accounts, computes total debits and credits, and adds a balancing line to the default `OWNER_CAPITAL` account when the opening lines do not already balance.

The posted journal uses:

- source type `OPENING_BALANCE`;
- source ID `OPENING_BALANCES` scoped to the business;
- origin `SYSTEM`;
- the cutover date as the posting date.

Because source identity is business-scoped, a second opening set for the same business is rejected by the posting kernel unless it is an equivalent idempotent retry.

## Account eligibility

The first release intentionally rejects unsupported shortcuts.

Opening-balance input lines must use active non-header, non-control balance-sheet accounts. The service rejects:

- header accounts;
- control accounts;
- revenue and expense accounts;
- bank accounts;
- accounts receivable and accounts payable controls;
- inventory and VAT controls;
- retained earnings;
- the reserved `OWNER_CAPITAL` balancing account as an input line.

This keeps receivables, payables, inventory, VAT, retained earnings, and bank reconciliation from receiving unsupported aggregate balances before their subledger and reconciliation policies exist.

## Balancing policy

The net difference between submitted opening debit and credit lines is posted to `OWNER_CAPITAL`.

- If debits exceed credits, the service credits owner capital.
- If credits exceed debits, the service debits owner capital.
- If submitted lines already balance, no balancing line is added.

The service does not post to retained earnings. Future retained-earnings and period-close behavior must be implemented through a dedicated closing policy.

## Safety and verification

The central posting kernel still enforces:

- accounting permission and entitlement;
- base-currency posting;
- open-period date guard;
- exact debit-equals-credit validation;
- active account checks;
- source uniqueness;
- payload-bound idempotency;
- immutable posted history;
- audit event creation.

Automated coverage verifies opening-balance input shape, owner-capital balancing, equivalent retry behavior, conflicting duplicate-source rejection, and blocked control, bank, and profit-and-loss accounts.

## Explicitly not implemented

- opening-balance UI;
- import workflow;
- approval workflow;
- draft opening sets;
- partial subledger opening balances for customers, suppliers, inventory, VAT, projects, or bank reconciliation;
- retained-earnings cutover;
- reversal or correction UI;
- ordinary manual journals.
