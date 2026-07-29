export type DefaultLedgerAccount = {
  systemKey: string;
  code: string;
  name: string;
  description: string;
  class: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  type:
    | "GENERAL"
    | "CASH"
    | "BANK"
    | "ACCOUNTS_RECEIVABLE"
    | "INVENTORY"
    | "PREPAYMENT"
    | "VAT_INPUT"
    | "OTHER_CURRENT_ASSET"
    | "FIXED_ASSET"
    | "ACCUMULATED_DEPRECIATION"
    | "ACCOUNTS_PAYABLE"
    | "VAT_OUTPUT"
    | "ACCRUED_EXPENSE"
    | "OTHER_CURRENT_LIABILITY"
    | "LONG_TERM_LIABILITY"
    | "OWNER_EQUITY"
    | "RETAINED_EARNINGS"
    | "SALES_REVENUE"
    | "SERVICE_REVENUE"
    | "OTHER_INCOME"
    | "COST_OF_GOODS_SOLD"
    | "DIRECT_COST"
    | "OPERATING_EXPENSE"
    | "DEPRECIATION_EXPENSE"
    | "OTHER_EXPENSE";
  normalBalance: "DEBIT" | "CREDIT";
  kind: "HEADER" | "POSTING" | "CONTROL";
  isContra: boolean;
  manualPostingAllowed: boolean;
  required: boolean;
  parentSystemKey: string | null;
};

export const defaultChartOfAccounts: readonly DefaultLedgerAccount[] = [
  { systemKey: "ASSETS", code: "1000", name: "Assets", description: "Asset accounts", class: "ASSET", type: "GENERAL", normalBalance: "DEBIT", kind: "HEADER", isContra: false, manualPostingAllowed: false, required: true, parentSystemKey: null },
  { systemKey: "CURRENT_ASSETS", code: "1100", name: "Current Assets", description: "Cash and assets expected to be used or realized within one year", class: "ASSET", type: "GENERAL", normalBalance: "DEBIT", kind: "HEADER", isContra: false, manualPostingAllowed: false, required: true, parentSystemKey: "ASSETS" },
  { systemKey: "CASH_ON_HAND", code: "1110", name: "Cash on Hand", description: "Physical cash and petty cash", class: "ASSET", type: "CASH", normalBalance: "DEBIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "CURRENT_ASSETS" },
  { systemKey: "BANK_ACCOUNT", code: "1120", name: "Bank Account", description: "Primary operating bank account", class: "ASSET", type: "BANK", normalBalance: "DEBIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "CURRENT_ASSETS" },
  { systemKey: "ACCOUNTS_RECEIVABLE", code: "1130", name: "Accounts Receivable", description: "Customer balances controlled by receivable subledgers", class: "ASSET", type: "ACCOUNTS_RECEIVABLE", normalBalance: "DEBIT", kind: "CONTROL", isContra: false, manualPostingAllowed: false, required: true, parentSystemKey: "CURRENT_ASSETS" },
  { systemKey: "INVENTORY", code: "1140", name: "Inventory", description: "Inventory value controlled by the stock ledger when enabled", class: "ASSET", type: "INVENTORY", normalBalance: "DEBIT", kind: "CONTROL", isContra: false, manualPostingAllowed: false, required: false, parentSystemKey: "CURRENT_ASSETS" },
  { systemKey: "PREPAYMENTS", code: "1150", name: "Prepayments", description: "Expenses paid before recognition", class: "ASSET", type: "PREPAYMENT", normalBalance: "DEBIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "CURRENT_ASSETS" },
  { systemKey: "VAT_INPUT", code: "1160", name: "VAT Recoverable", description: "Recoverable input VAT control account", class: "ASSET", type: "VAT_INPUT", normalBalance: "DEBIT", kind: "CONTROL", isContra: false, manualPostingAllowed: false, required: false, parentSystemKey: "CURRENT_ASSETS" },
  { systemKey: "NON_CURRENT_ASSETS", code: "1200", name: "Non-current Assets", description: "Long-term assets", class: "ASSET", type: "GENERAL", normalBalance: "DEBIT", kind: "HEADER", isContra: false, manualPostingAllowed: false, required: true, parentSystemKey: "ASSETS" },
  { systemKey: "PROPERTY_EQUIPMENT", code: "1210", name: "Property and Equipment", description: "Property, plant, equipment, and capitalized assets", class: "ASSET", type: "FIXED_ASSET", normalBalance: "DEBIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "NON_CURRENT_ASSETS" },
  { systemKey: "ACCUMULATED_DEPRECIATION", code: "1220", name: "Accumulated Depreciation", description: "Contra-asset accumulated depreciation", class: "ASSET", type: "ACCUMULATED_DEPRECIATION", normalBalance: "CREDIT", kind: "POSTING", isContra: true, manualPostingAllowed: true, required: false, parentSystemKey: "NON_CURRENT_ASSETS" },
  { systemKey: "LIABILITIES", code: "2000", name: "Liabilities", description: "Liability accounts", class: "LIABILITY", type: "GENERAL", normalBalance: "CREDIT", kind: "HEADER", isContra: false, manualPostingAllowed: false, required: true, parentSystemKey: null },
  { systemKey: "CURRENT_LIABILITIES", code: "2100", name: "Current Liabilities", description: "Obligations expected to settle within one year", class: "LIABILITY", type: "GENERAL", normalBalance: "CREDIT", kind: "HEADER", isContra: false, manualPostingAllowed: false, required: true, parentSystemKey: "LIABILITIES" },
  { systemKey: "ACCOUNTS_PAYABLE", code: "2110", name: "Accounts Payable", description: "Supplier balances controlled by payable subledgers", class: "LIABILITY", type: "ACCOUNTS_PAYABLE", normalBalance: "CREDIT", kind: "CONTROL", isContra: false, manualPostingAllowed: false, required: true, parentSystemKey: "CURRENT_LIABILITIES" },
  { systemKey: "VAT_OUTPUT", code: "2120", name: "VAT Payable", description: "Output VAT control account", class: "LIABILITY", type: "VAT_OUTPUT", normalBalance: "CREDIT", kind: "CONTROL", isContra: false, manualPostingAllowed: false, required: false, parentSystemKey: "CURRENT_LIABILITIES" },
  { systemKey: "ACCRUED_EXPENSES", code: "2130", name: "Accrued Expenses", description: "Expenses incurred but not yet paid", class: "LIABILITY", type: "ACCRUED_EXPENSE", normalBalance: "CREDIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "CURRENT_LIABILITIES" },
  { systemKey: "NON_CURRENT_LIABILITIES", code: "2200", name: "Non-current Liabilities", description: "Long-term obligations", class: "LIABILITY", type: "GENERAL", normalBalance: "CREDIT", kind: "HEADER", isContra: false, manualPostingAllowed: false, required: true, parentSystemKey: "LIABILITIES" },
  { systemKey: "LOANS_PAYABLE", code: "2210", name: "Loans Payable", description: "Long-term loans and financing obligations", class: "LIABILITY", type: "LONG_TERM_LIABILITY", normalBalance: "CREDIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "NON_CURRENT_LIABILITIES" },
  { systemKey: "EQUITY", code: "3000", name: "Equity", description: "Owner and accumulated equity", class: "EQUITY", type: "GENERAL", normalBalance: "CREDIT", kind: "HEADER", isContra: false, manualPostingAllowed: false, required: true, parentSystemKey: null },
  { systemKey: "OWNER_CAPITAL", code: "3100", name: "Owner Capital", description: "Owner contributions and capital", class: "EQUITY", type: "OWNER_EQUITY", normalBalance: "CREDIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "EQUITY" },
  { systemKey: "RETAINED_EARNINGS", code: "3200", name: "Retained Earnings", description: "Accumulated earnings controlled by period close", class: "EQUITY", type: "RETAINED_EARNINGS", normalBalance: "CREDIT", kind: "CONTROL", isContra: false, manualPostingAllowed: false, required: true, parentSystemKey: "EQUITY" },
  { systemKey: "REVENUE", code: "4000", name: "Revenue", description: "Operating and other revenue", class: "REVENUE", type: "GENERAL", normalBalance: "CREDIT", kind: "HEADER", isContra: false, manualPostingAllowed: false, required: true, parentSystemKey: null },
  { systemKey: "SALES_REVENUE", code: "4100", name: "Sales Revenue", description: "Revenue from product sales", class: "REVENUE", type: "SALES_REVENUE", normalBalance: "CREDIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "REVENUE" },
  { systemKey: "SERVICE_REVENUE", code: "4200", name: "Service Revenue", description: "Revenue from services", class: "REVENUE", type: "SERVICE_REVENUE", normalBalance: "CREDIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "REVENUE" },
  { systemKey: "OTHER_INCOME", code: "4300", name: "Other Income", description: "Non-core operating income", class: "REVENUE", type: "OTHER_INCOME", normalBalance: "CREDIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "REVENUE" },
  { systemKey: "COST_OF_SALES", code: "5000", name: "Cost of Sales", description: "Direct costs associated with revenue", class: "EXPENSE", type: "GENERAL", normalBalance: "DEBIT", kind: "HEADER", isContra: false, manualPostingAllowed: false, required: true, parentSystemKey: null },
  { systemKey: "COST_OF_GOODS_SOLD", code: "5100", name: "Cost of Goods Sold", description: "Cost of products sold", class: "EXPENSE", type: "COST_OF_GOODS_SOLD", normalBalance: "DEBIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "COST_OF_SALES" },
  { systemKey: "DIRECT_COSTS", code: "5200", name: "Direct Costs", description: "Direct service and job costs", class: "EXPENSE", type: "DIRECT_COST", normalBalance: "DEBIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "COST_OF_SALES" },
  { systemKey: "OPERATING_EXPENSES", code: "6000", name: "Operating Expenses", description: "General operating expenses", class: "EXPENSE", type: "GENERAL", normalBalance: "DEBIT", kind: "HEADER", isContra: false, manualPostingAllowed: false, required: true, parentSystemKey: null },
  { systemKey: "SALARIES_WAGES", code: "6100", name: "Salaries and Wages", description: "Employee salaries, wages, and related costs", class: "EXPENSE", type: "OPERATING_EXPENSE", normalBalance: "DEBIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "OPERATING_EXPENSES" },
  { systemKey: "RENT_EXPENSE", code: "6200", name: "Rent Expense", description: "Office, workshop, and facility rent", class: "EXPENSE", type: "OPERATING_EXPENSE", normalBalance: "DEBIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "OPERATING_EXPENSES" },
  { systemKey: "UTILITIES_EXPENSE", code: "6300", name: "Utilities Expense", description: "Electricity, water, telecommunications, and utilities", class: "EXPENSE", type: "OPERATING_EXPENSE", normalBalance: "DEBIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "OPERATING_EXPENSES" },
  { systemKey: "PROFESSIONAL_FEES", code: "6400", name: "Professional Fees", description: "Legal, accounting, consulting, and professional services", class: "EXPENSE", type: "OPERATING_EXPENSE", normalBalance: "DEBIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "OPERATING_EXPENSES" },
  { systemKey: "VEHICLE_TRAVEL", code: "6500", name: "Vehicle and Travel", description: "Vehicle, fuel, transport, and business travel", class: "EXPENSE", type: "OPERATING_EXPENSE", normalBalance: "DEBIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "OPERATING_EXPENSES" },
  { systemKey: "DEPRECIATION_EXPENSE", code: "6600", name: "Depreciation Expense", description: "Periodic depreciation expense", class: "EXPENSE", type: "DEPRECIATION_EXPENSE", normalBalance: "DEBIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "OPERATING_EXPENSES" },
  { systemKey: "GENERAL_ADMIN", code: "6700", name: "General and Administrative", description: "General administrative costs", class: "EXPENSE", type: "OPERATING_EXPENSE", normalBalance: "DEBIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "OPERATING_EXPENSES" },
  { systemKey: "BANK_CHARGES", code: "6800", name: "Bank Charges", description: "Bank charges and transaction fees", class: "EXPENSE", type: "OPERATING_EXPENSE", normalBalance: "DEBIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "OPERATING_EXPENSES" },
  { systemKey: "OTHER_EXPENSE", code: "6900", name: "Other Expense", description: "Other operating expenses", class: "EXPENSE", type: "OTHER_EXPENSE", normalBalance: "DEBIT", kind: "POSTING", isContra: false, manualPostingAllowed: true, required: false, parentSystemKey: "OPERATING_EXPENSES" },
] as const;

export function defaultLedgerAccountId(businessId: string, systemKey: string) {
  return `${businessId}:coa:${systemKey.toLowerCase()}`;
}

export function defaultLedgerAccountRows(tenantId: string, businessId: string) {
  return defaultChartOfAccounts.map((account) => ({
    id: defaultLedgerAccountId(businessId, account.systemKey),
    tenantId,
    businessId,
    code: account.code,
    name: account.name,
    description: account.description,
    class: account.class,
    type: account.type,
    normalBalance: account.normalBalance,
    kind: account.kind,
    isContra: account.isContra,
    manualPostingAllowed: account.manualPostingAllowed,
    systemKey: account.systemKey,
    systemManaged: true,
    required: account.required,
    status: "ACTIVE" as const,
    parentId: account.parentSystemKey ? defaultLedgerAccountId(businessId, account.parentSystemKey) : null,
  }));
}