import { describe, expect, it } from "vitest";
import {
  accountingPeriodTransitionSchema,
  createAccountingPeriodSchema,
  fiscalYearBounds,
  formatAccountingDate,
  parseAccountingDate,
} from "../src/modules/accounting/contracts/periods";

describe("accounting period contracts", () => {
  it("accepts valid date-only ranges", () => {
    expect(createAccountingPeriodSchema.parse({
      name: "January 2027",
      startDate: "2027-01-01",
      endDate: "2027-01-31",
    })).toEqual({ name: "January 2027", startDate: "2027-01-01", endDate: "2027-01-31" });
    expect(formatAccountingDate(parseAccountingDate("2027-01-31"))).toBe("2027-01-31");
  });

  it("rejects invalid calendar dates and reversed ranges", () => {
    expect(() => createAccountingPeriodSchema.parse({ name: "Invalid", startDate: "2027-02-30", endDate: "2027-03-01" })).toThrow();
    expect(() => createAccountingPeriodSchema.parse({ name: "Invalid", startDate: "2027-03-02", endDate: "2027-03-01" })).toThrow();
  });

  it("requires a meaningful transition reason", () => {
    expect(accountingPeriodTransitionSchema.parse({ status: "SOFT_LOCKED", reason: "Month-end review" })).toEqual({
      status: "SOFT_LOCKED",
      reason: "Month-end review",
    });
    expect(() => accountingPeriodTransitionSchema.parse({ status: "CLOSED", reason: "x" })).toThrow();
  });

  it("derives calendar and non-calendar fiscal-year bounds", () => {
    const calendar = fiscalYearBounds(parseAccountingDate("2027-05-15"), 1);
    expect(formatAccountingDate(calendar.start)).toBe("2027-01-01");
    expect(formatAccountingDate(calendar.end)).toBe("2027-12-31");

    const april = fiscalYearBounds(parseAccountingDate("2027-02-15"), 4);
    expect(formatAccountingDate(april.start)).toBe("2026-04-01");
    expect(formatAccountingDate(april.end)).toBe("2027-03-31");
  });
});
