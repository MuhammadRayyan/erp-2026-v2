import { describe, expect, it } from "vitest";
import { postOpeningBalancesSchema } from "../src/modules/accounting/contracts/opening-balances";

const valid = {
  cutoverDate: "2027-01-01",
  idempotencyKey: "opening-balances-1",
  memo: null,
  lines: [
    { accountId: "cash", description: null, debit: "100.0000", credit: "0" },
  ],
};

describe("opening balance contract", () => {
  it("accepts one-sided exact opening lines", () => {
    expect(postOpeningBalancesSchema.parse(valid).cutoverDate).toBe("2027-01-01");
  });

  it("accepts validated import-preview evidence", () => {
    const parsed = postOpeningBalancesSchema.parse({
      ...valid,
      importSummary: {
        rowCount: 1,
        totalDebit: "100.0000",
        totalCredit: "0.0000",
        netDifference: "100.0000",
        fingerprint: "obimp_1234abcd",
      },
    });

    expect(parsed.importSummary?.fingerprint).toBe("obimp_1234abcd");
  });

  it("rejects malformed amounts and dual-sided lines", () => {
    expect(() => postOpeningBalancesSchema.parse({
      ...valid,
      lines: [{ accountId: "cash", description: null, debit: "100.12345", credit: "0" }],
    })).toThrow();

    expect(() => postOpeningBalancesSchema.parse({
      ...valid,
      lines: [{ accountId: "cash", description: null, debit: "10", credit: "10" }],
    })).toThrow();
  });

  it("rejects malformed import-preview evidence", () => {
    expect(() => postOpeningBalancesSchema.parse({
      ...valid,
      importSummary: {
        rowCount: 0,
        totalDebit: "100.0000",
        totalCredit: "0.0000",
        netDifference: "100.0000",
        fingerprint: "not-a-preview-fingerprint",
      },
    })).toThrow();
  });

  it("requires a durable idempotency key", () => {
    expect(() => postOpeningBalancesSchema.parse({ ...valid, idempotencyKey: "short" })).toThrow();
  });
});
