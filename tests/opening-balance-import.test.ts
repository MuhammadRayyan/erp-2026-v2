import { describe, expect, it } from "vitest";
import { parseOpeningBalanceCsv } from "../src/modules/accounting/contracts/opening-balance-import";

const accounts = [
  { id: "cash-id", code: "1010" },
  { id: "loan-id", code: "2200" },
];

describe("opening balance CSV import", () => {
  it("parses valid opening-balance CSV rows by eligible account code", () => {
    const result = parseOpeningBalanceCsv(`accountCode,description,debit,credit
1010,"Cash, counted",100.0000,0
2200,Loan at cutover,0,40.25`, accounts);

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { accountId: "cash-id", description: "Cash, counted", debit: "100.0000", credit: "0" },
      { accountId: "loan-id", description: "Loan at cutover", debit: "0", credit: "40.25" },
    ]);
  });

  it("rejects unknown accounts, malformed amounts, and dual-sided rows", () => {
    const result = parseOpeningBalanceCsv(`9999,Unknown,10,0
1010,Bad precision,10.12345,0
2200,Dual sided,5,5`, accounts);

    expect(result.rows).toEqual([]);
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0]).toContain("9999");
    expect(result.errors[1]).toContain("Amounts must be non-negative");
    expect(result.errors[2]).toContain("exactly one positive debit or credit");
  });

  it("requires at least one row", () => {
    expect(parseOpeningBalanceCsv("", accounts).errors).toEqual(["Paste at least one opening-balance row."]);
  });
});
