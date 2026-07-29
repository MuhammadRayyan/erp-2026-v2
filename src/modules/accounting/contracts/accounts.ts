import { z } from "zod";

export const accountClasses = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;
export const accountNormalBalances = ["DEBIT", "CREDIT"] as const;
export const accountKinds = ["HEADER", "POSTING", "CONTROL"] as const;
export const accountStatuses = ["ACTIVE", "INACTIVE"] as const;
export const accountTypes = [
  "GENERAL",
  "CASH",
  "BANK",
  "ACCOUNTS_RECEIVABLE",
  "INVENTORY",
  "PREPAYMENT",
  "VAT_INPUT",
  "OTHER_CURRENT_ASSET",
  "FIXED_ASSET",
  "ACCUMULATED_DEPRECIATION",
  "ACCOUNTS_PAYABLE",
  "VAT_OUTPUT",
  "ACCRUED_EXPENSE",
  "OTHER_CURRENT_LIABILITY",
  "LONG_TERM_LIABILITY",
  "OWNER_EQUITY",
  "RETAINED_EARNINGS",
  "SALES_REVENUE",
  "SERVICE_REVENUE",
  "OTHER_INCOME",
  "COST_OF_GOODS_SOLD",
  "DIRECT_COST",
  "OPERATING_EXPENSE",
  "DEPRECIATION_EXPENSE",
  "OTHER_EXPENSE",
] as const;

export type AccountClassValue = (typeof accountClasses)[number];
export type AccountTypeValue = (typeof accountTypes)[number];

export const accountTypesByClass: Record<AccountClassValue, readonly AccountTypeValue[]> = {
  ASSET: ["GENERAL", "CASH", "BANK", "ACCOUNTS_RECEIVABLE", "INVENTORY", "PREPAYMENT", "VAT_INPUT", "OTHER_CURRENT_ASSET", "FIXED_ASSET", "ACCUMULATED_DEPRECIATION"],
  LIABILITY: ["GENERAL", "ACCOUNTS_PAYABLE", "VAT_OUTPUT", "ACCRUED_EXPENSE", "OTHER_CURRENT_LIABILITY", "LONG_TERM_LIABILITY"],
  EQUITY: ["GENERAL", "OWNER_EQUITY", "RETAINED_EARNINGS"],
  REVENUE: ["GENERAL", "SALES_REVENUE", "SERVICE_REVENUE", "OTHER_INCOME"],
  EXPENSE: ["GENERAL", "COST_OF_GOODS_SOLD", "DIRECT_COST", "OPERATING_EXPENSE", "DEPRECIATION_EXPENSE", "OTHER_EXPENSE"],
};

const controlTypes = new Set<AccountTypeValue>([
  "ACCOUNTS_RECEIVABLE",
  "INVENTORY",
  "VAT_INPUT",
  "ACCOUNTS_PAYABLE",
  "VAT_OUTPUT",
  "RETAINED_EARNINGS",
]);

export function expectedNormalBalance(accountClass: AccountClassValue, isContra: boolean) {
  const standard = accountClass === "ASSET" || accountClass === "EXPENSE" ? "DEBIT" : "CREDIT";
  if (!isContra) return standard;
  return standard === "DEBIT" ? "CREDIT" : "DEBIT";
}

const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((value) => value || null);
const optionalId = z.string().trim().min(1).nullish().transform((value) => value || null);

const accountShape = z.object({
  code: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9][A-Za-z0-9.-]*$/).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(160),
  description: optionalText(1000),
  class: z.enum(accountClasses),
  type: z.enum(accountTypes),
  normalBalance: z.enum(accountNormalBalances),
  kind: z.enum(accountKinds),
  isContra: z.boolean(),
  manualPostingAllowed: z.boolean(),
  parentId: optionalId,
});

function validateAccountShape(value: z.infer<typeof accountShape>, context: z.RefinementCtx) {
  if (!accountTypesByClass[value.class].includes(value.type)) {
    context.addIssue({ code: "custom", path: ["type"], message: "The account type does not belong to the selected class." });
  }
  if (value.normalBalance !== expectedNormalBalance(value.class, value.isContra)) {
    context.addIssue({ code: "custom", path: ["normalBalance"], message: "Normal balance does not match the class and contra setting." });
  }
  if (value.kind === "HEADER" && value.type !== "GENERAL") {
    context.addIssue({ code: "custom", path: ["type"], message: "Header accounts must use the general type." });
  }
  if ((value.kind === "HEADER" || value.kind === "CONTROL") && value.manualPostingAllowed) {
    context.addIssue({ code: "custom", path: ["manualPostingAllowed"], message: "Header and control accounts cannot allow manual posting." });
  }
  if (controlTypes.has(value.type) && value.kind !== "CONTROL") {
    context.addIssue({ code: "custom", path: ["kind"], message: "This account type must be a control account." });
  }
  if (value.type === "ACCUMULATED_DEPRECIATION" && !value.isContra) {
    context.addIssue({ code: "custom", path: ["isContra"], message: "Accumulated depreciation must be a contra account." });
  }
}

export const createLedgerAccountSchema = accountShape.superRefine(validateAccountShape);
export const updateLedgerAccountSchema = accountShape.superRefine(validateAccountShape);
export const ledgerAccountStatusSchema = z.object({ status: z.enum(accountStatuses) });

export type CreateLedgerAccountInput = z.input<typeof createLedgerAccountSchema>;
export type UpdateLedgerAccountInput = z.input<typeof updateLedgerAccountSchema>;