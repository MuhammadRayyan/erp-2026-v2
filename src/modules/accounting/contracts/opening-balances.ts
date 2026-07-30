import { z } from "zod";

const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable();
const amountSchema = z.string().trim().regex(/^\d{1,16}(?:\.\d{1,4})?$/, "Use a non-negative amount with up to four decimal places.");
const signedAmountSchema = z.string().trim().regex(/^-?\d{1,16}(?:\.\d{1,4})?$/, "Use an amount with up to four decimal places.");

export const openingBalanceLineSchema = z.object({
  accountId: z.string().trim().min(1).max(191),
  description: nullableText(300),
  debit: amountSchema,
  credit: amountSchema,
}).superRefine((line, context) => {
  const debit = Number(line.debit);
  const credit = Number(line.credit);
  if (!Number.isFinite(debit) || !Number.isFinite(credit) || (debit > 0) === (credit > 0)) {
    context.addIssue({
      code: "custom",
      path: ["debit"],
      message: "Each opening-balance line requires exactly one positive debit or credit amount.",
    });
  }
});

export const openingBalanceImportSummarySchema = z.object({
  rowCount: z.number().int().min(1).max(500),
  totalDebit: amountSchema,
  totalCredit: amountSchema,
  netDifference: signedAmountSchema,
  fingerprint: z.string().trim().regex(/^obimp_[0-9a-f]{8}$/),
});

export const postOpeningBalancesSchema = z.object({
  cutoverDate: z.string().date(),
  idempotencyKey: z.string().trim().min(8).max(160),
  memo: nullableText(500),
  importSummary: openingBalanceImportSummarySchema.optional(),
  lines: z.array(openingBalanceLineSchema).min(1).max(500),
});

export type OpeningBalanceLineInput = z.input<typeof openingBalanceLineSchema>;
export type OpeningBalanceImportSummaryInput = z.input<typeof openingBalanceImportSummarySchema>;
export type PostOpeningBalancesInput = z.input<typeof postOpeningBalancesSchema>;
