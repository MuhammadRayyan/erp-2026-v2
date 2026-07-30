import { z } from "zod";

const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable();
const amountSchema = z.string().trim().regex(/^\d{1,16}(?:\.\d{1,4})?$/, "Use a non-negative amount with up to four decimal places.");

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

export const postOpeningBalancesSchema = z.object({
  cutoverDate: z.string().date(),
  idempotencyKey: z.string().trim().min(8).max(160),
  memo: nullableText(500),
  lines: z.array(openingBalanceLineSchema).min(1).max(500),
});

export type OpeningBalanceLineInput = z.input<typeof openingBalanceLineSchema>;
export type PostOpeningBalancesInput = z.input<typeof postOpeningBalancesSchema>;
