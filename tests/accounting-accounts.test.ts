import { describe, expect, it } from "vitest";
import {
  accountTypesByClass,
  createLedgerAccountSchema,
  expectedNormalBalance,
} from "../src/modules/accounting/contracts/accounts";
import { defaultChartOfAccounts } from "../src/modules/accounting/default-chart";

describe("accounting account contracts", () => {
  it("derives standard and contra normal balances", () => {
    expect(expectedNormalBalance("ASSET", false)).toBe("DEBIT");
    expect(expectedNormalBalance("EXPENSE", true)).toBe("CREDIT");
    expect(expectedNormalBalance("LIABILITY", false)).toBe("CREDIT");
    expect(expectedNormalBalance("REVENUE", true)).toBe("DEBIT");
  });

  it("rejects invalid class, kind, and balance combinations", () => {
    expect(() => createLedgerAccountSchema.parse({
      code: "1001",
      name: "Invalid payable",
      description: null,
      class: "ASSET",
      type: "ACCOUNTS_PAYABLE",
      normalBalance: "CREDIT",
      kind: "POSTING",
      isContra: false,
      manualPostingAllowed: true,
      parentId: null,
    })).toThrow();

    expect(() => createLedgerAccountSchema.parse({
      code: "1002",
      name: "Invalid header",
      description: null,
      class: "ASSET",
      type: "CASH",
      normalBalance: "DEBIT",
      kind: "HEADER",
      isContra: false,
      manualPostingAllowed: false,
      parentId: null,
    })).toThrow();
  });

  it("keeps the default chart internally consistent", () => {
    const keys = new Set(defaultChartOfAccounts.map((account) => account.systemKey));
    const codes = new Set(defaultChartOfAccounts.map((account) => account.code));
    expect(keys.size).toBe(defaultChartOfAccounts.length);
    expect(codes.size).toBe(defaultChartOfAccounts.length);

    for (const account of defaultChartOfAccounts) {
      expect(accountTypesByClass[account.class]).toContain(account.type);
      expect(account.normalBalance).toBe(expectedNormalBalance(account.class, account.isContra));
      if (account.parentSystemKey) expect(keys.has(account.parentSystemKey)).toBe(true);
      if (account.kind === "HEADER" || account.kind === "CONTROL") expect(account.manualPostingAllowed).toBe(false);
      if (account.required) expect(account.systemKey.length).toBeGreaterThan(0);
    }
  });
});