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

  it("requires a durable idempotency key", () => {
    expect(() => postOpeningBalancesSchema.parse({ ...valid, idempotencyKey: "short" })).toThrow();
  });
});
