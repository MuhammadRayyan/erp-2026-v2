import { z } from "zod";

const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable();
const amountSchema = z.string().trim().regex(/^\d{1,16}(?:\.\d{1,4})?$/, "Use a non-negative amount with up to four decimal places.");

export const journalLineInputSchema = z.object({
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
      message: "Each journal line requires exactly one positive debit or credit amount.",
    });
  }
});

export const postJournalEntrySchema = z.object({
  postingDate: z.string().date(),
  currencyCode: z.string().trim().length(3).regex(/^[A-Z]{3}$/),
  origin: z.enum(["SYSTEM", "MANUAL"]),
  sourceType: z.string().trim().min(1).max(80).regex(/^[A-Z][A-Z0-9_]*$/),
  sourceId: z.string().trim().min(1).max(160),
  idempotencyKey: z.string().trim().min(8).max(160),
  memo: nullableText(500),
  lines: z.array(journalLineInputSchema).min(2).max(500),
});

export const reverseJournalEntrySchema = z.object({
  postingDate: z.string().date(),
  idempotencyKey: z.string().trim().min(8).max(160),
  reason: z.string().trim().min(3).max(500),
});

export type JournalLineInput = z.input<typeof journalLineInputSchema>;
export type PostJournalEntryInput = z.input<typeof postJournalEntrySchema>;
export type ReverseJournalEntryInput = z.input<typeof reverseJournalEntrySchema>;
