export type OpeningBalanceBlockedPolicyArea =
  | "Receivables"
  | "Payables"
  | "Inventory"
  | "Bank"
  | "VAT"
  | "Retained earnings";

export type OpeningBalanceBlockedPolicy = {
  area: OpeningBalanceBlockedPolicyArea;
  blocked: string;
  requiredPolicy: string;
};

export const openingBalanceBlockedPolicyRows = [
  {
    area: "Receivables",
    blocked: "Accounts receivable control balances",
    requiredPolicy: "Customer-level opening invoices, aging, allocation, and VAT evidence.",
  },
  {
    area: "Payables",
    blocked: "Accounts payable control balances",
    requiredPolicy: "Supplier-level opening bills, aging, payment allocation, and tax evidence.",
  },
  {
    area: "Inventory",
    blocked: "Inventory and cost controls",
    requiredPolicy: "Item/location quantities, valuation method, and stock audit trail.",
  },
  {
    area: "Bank",
    blocked: "Bank account shortcuts",
    requiredPolicy: "Opening bank statement balance, unreconciled items, and reconciliation start point.",
  },
  {
    area: "VAT",
    blocked: "VAT input/output controls",
    requiredPolicy: "Return-period liability, recoverable tax evidence, and filing status.",
  },
  {
    area: "Retained earnings",
    blocked: "Direct retained-earnings cutover",
    requiredPolicy: "Prior-period close and retained-earnings transfer policy.",
  },
] as const satisfies readonly OpeningBalanceBlockedPolicy[];
