import { z } from "zod";

const template = z.string().trim().max(80).refine(
  (value) => !value.match(/\{(?!YYYY\}|YY\}|MM\})[^}]+\}/),
  "Only {YYYY}, {YY}, and {MM} date tokens are supported.",
);

export const updateNumberSequenceSchema = z.object({
  label: z.string().trim().min(2).max(100),
  prefixTemplate: template,
  suffixTemplate: template,
  padding: z.coerce.number().int().min(1).max(12),
  startValue: z.coerce.number().int().positive().max(2_000_000_000),
  resetPolicy: z.enum(["NEVER", "YEARLY", "MONTHLY"]),
  active: z.boolean(),
});

export const allocateNumberSchema = z.object({
  sequenceKey: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,79}$/),
  idempotencyKey: z.string().trim().min(8).max(200),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  referenceType: z.string().trim().max(80).optional().nullable(),
  referenceId: z.string().trim().max(191).optional().nullable(),
});

export const voidNumberAllocationSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export type UpdateNumberSequenceInput = z.input<typeof updateNumberSequenceSchema>;
export type AllocateNumberInput = z.input<typeof allocateNumberSchema>;
