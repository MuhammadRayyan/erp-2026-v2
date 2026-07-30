import { describe, expect, it } from "vitest";
import { openingBalanceBlockedPolicyRows } from "../src/modules/accounting/contracts/opening-balance-policies";

const expectedAreas = [
  "Receivables",
  "Payables",
  "Inventory",
  "Bank",
  "VAT",
  "Retained earnings",
];

describe("opening balance blocked policy rows", () => {
  it("keeps all blocked cutover policy areas explicit", () => {
    expect(openingBalanceBlockedPolicyRows.map((row) => row.area)).toEqual(expectedAreas);
  });

  it("provides operator-facing blocked shortcut and enablement policy text", () => {
    for (const row of openingBalanceBlockedPolicyRows) {
      expect(row.blocked.trim().length).toBeGreaterThan(10);
      expect(row.requiredPolicy.trim().length).toBeGreaterThan(20);
    }
  });
});
