# Controlled Opening Balances

This guide defines the initial Phase 4 opening-balance workflow boundary. Opening balances are not an ordinary manual journal workflow. They are a controlled business cutover posting that uses the central accounting kernel.

## Scope

The backend service accepts one opening-balance set for a business and posts it as one journal through `postJournalEntry`.

The workspace page at `/business/[businessId]/accounting/opening-balances` provides the first controlled browser entry point for users with accounting management access. It offers only eligible account choices, posts through the opening-balance API route, and redirects successful postings to immutable journal evidence.

Users can enter lines manually or paste CSV with columns `accountCode,description,debit,credit`. CSV import only fills editable review rows in the browser. The import preview shows row count, debit total, credit total, net difference, and a deterministic preview fingerprint so operators can compare what they reviewed before posting. When a current import preview is posted, the backend recomputes and validates the preview evidence from the submitted lines before appending a compact fingerprint/totals line to the posted journal memo. Final posting still uses the protected opening-balance API route and backend service.

After the opening set is posted, the page reads the existing source-owned journal and shows a posted-status panel with a journal evidence link instead of presenting another posting form. The posting kernel remains the final guard against duplicate source posting.

The request contains:

- a cutover accounting date;
- a stable idempotency key;
- optional memo;
- optional current import-preview summary evidence;
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

This keeps receivables, payables, inventory, VAT, retained earnings, and bank reconciliation from receiving unsupported aggregate balances before their subledger and reconciliation policies exist. The workspace account list uses the same eligibility helper as the backend, but the backend remains the final authority. The CSV parser also maps by this eligible account-code list, so unsupported account codes never become postable rows.

## Blocked policy matrix

The workspace shows the blocked subledger and control-account areas as an explicit policy matrix so operators can distinguish supported cutover accounts from future work. The rows are defined in `opening-balance-policies.ts` and covered by unit tests to keep the workspace, operating guide, and future policy work aligned.

| Area | Blocked shortcut | Required policy before enablement |
| --- | --- | --- |
| Receivables | Accounts receivable control balances | Customer-level opening invoices, aging, allocation, and VAT evidence. |
| Payables | Accounts payable control balances | Supplier-level opening bills, aging, payment allocation, and tax evidence. |
| Inventory | Inventory and cost controls | Item/location quantities, valuation method, and stock audit trail. |
| Bank | Bank account shortcuts | Opening bank statement balance, unreconciled items, and reconciliation start point. |
| VAT | VAT input/output controls | Return-period liability, recoverable tax evidence, and filing status. |
| Retained earnings | Direct retained-earnings cutover | Prior-period close and retained-earnings transfer policy. |

These rows are informational in the browser. The backend eligibility helper and posting kernel remain the enforcement boundary.

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

Automated coverage verifies opening-balance input shape, CSV parsing, summary totals, stable preview fingerprinting, import-evidence contract validation, server-side import-evidence recomputation and mismatch rejection, posted journal memo evidence, rejected import rows, posted-status lookup, blocked policy matrix coverage, owner-capital balancing, equivalent retry behavior, conflicting duplicate-source rejection, and blocked control, bank, and profit-and-loss accounts. The workspace workflow reuses the existing protected session, business access, entitlement, and posting-date boundaries.

## Explicitly not implemented

- durable import batches;
- approval workflow;
- draft opening sets;
- partial subledger opening balances for customers, suppliers, inventory, VAT, projects, or bank reconciliation;
- retained-earnings cutover;
- reversal or correction UI;
- ordinary manual journals.
