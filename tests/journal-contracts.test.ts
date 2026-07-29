import { describe, expect, it } from "vitest";
import { postJournalEntrySchema, reverseJournalEntrySchema } from "../src/modules/accounting/contracts/journals";

const valid = {
  postingDate: "2027-01-15",
  currencyCode: "AED",
  origin: "SYSTEM" as const,
  sourceType: "TEST_SOURCE",
  sourceId: "source-1",
  idempotencyKey: "journal-contract-1",
  memo: null,
  lines: [
    { accountId: "cash", description: null, debit: "100.0000", credit: "0" },
    { accountId: "revenue", description: null, debit: "0", credit: "100.0000" },
  ],
};

describe("journal contracts", () => {
  it("accepts exact four-decimal balanced-shaped input", () => {
    expect(postJournalEntrySchema.parse(valid).currencyCode).toBe("AED");
  });

  it("rejects malformed amounts and dual-sided lines", () => {
    expect(() => postJournalEntrySchema.parse({
      ...valid,
      lines: [
        { accountId: "cash", description: null, debit: "10.12345", credit: "0" },
        { accountId: "revenue", description: null, debit: "5", credit: "5" },
      ],
    })).toThrow();
  });

  it("requires stable source and idempotency identifiers", () => {
    expect(() => postJournalEntrySchema.parse({ ...valid, sourceType: "invalid type" })).toThrow();
    expect(() => postJournalEntrySchema.parse({ ...valid, idempotencyKey: "short" })).toThrow();
  });

  it("requires a reason for reversals", () => {
    expect(() => reverseJournalEntrySchema.parse({
      postingDate: "2027-01-31",
      idempotencyKey: "journal-reversal-1",
      reason: "x",
    })).toThrow();
  });
});
