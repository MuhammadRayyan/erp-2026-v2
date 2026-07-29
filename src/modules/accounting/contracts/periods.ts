import { z } from "zod";

export const accountingPeriodStatuses = ["OPEN", "SOFT_LOCKED", "CLOSED"] as const;

const dateOnly = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").superRefine((value, context) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    context.addIssue({ code: "custom", message: "Enter a valid calendar date." });
  }
});

const periodShape = z.object({
  name: z.string().trim().min(1).max(100),
  startDate: dateOnly,
  endDate: dateOnly,
}).superRefine((value, context) => {
  if (value.startDate > value.endDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date." });
  }
});

export const createAccountingPeriodSchema = periodShape;
export const updateAccountingPeriodSchema = periodShape;
export const accountingPeriodTransitionSchema = z.object({
  status: z.enum(accountingPeriodStatuses),
  reason: z.string().trim().min(3).max(500),
});

export type CreateAccountingPeriodInput = z.input<typeof createAccountingPeriodSchema>;
export type UpdateAccountingPeriodInput = z.input<typeof updateAccountingPeriodSchema>;
export type AccountingPeriodTransitionInput = z.input<typeof accountingPeriodTransitionSchema>;

export function parseAccountingDate(value: string) {
  dateOnly.parse(value);
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatAccountingDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function fiscalYearBounds(date: Date, fiscalYearStartMonth: number) {
  const month = date.getUTCMonth() + 1;
  const startYear = month < fiscalYearStartMonth ? date.getUTCFullYear() - 1 : date.getUTCFullYear();
  const start = new Date(Date.UTC(startYear, fiscalYearStartMonth - 1, 1));
  const end = new Date(Date.UTC(startYear + 1, fiscalYearStartMonth - 1, 0));
  return { start, end };
}
