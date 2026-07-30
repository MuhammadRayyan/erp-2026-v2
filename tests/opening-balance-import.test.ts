import { describe, expect, it } from "vitest";
import { parseOpeningBalanceCsv, parseOpeningBalanceImportEvidenceMemo } from "../src/modules/accounting/contracts/opening-balance-import";

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
    expect(result.summary).toMatchObject({
      rowCount: 2,
      totalDebit: "100.0000",
      totalCredit: "40.2500",
      netDifference: "59.7500",
    });
    expect(result.summary.fingerprint).toMatch(/^obimp_[0-9a-f]{8}$/);
  });

  it("uses a stable fingerprint for equivalent imports", () => {
    const first = parseOpeningBalanceCsv(`accountCode,description,debit,credit
1010,Cash counted,100,0`, accounts);
    const second = parseOpeningBalanceCsv(`accountCode,description,debit,credit
1010,Cash counted,100.0000,0.0000`, accounts);

    expect(first.errors).toEqual([]);
    expect(second.errors).toEqual([]);
    expect(first.summary.fingerprint).toBe(second.summary.fingerprint);
  });

  it("parses posted import evidence from journal memos", () => {
    expect(parseOpeningBalanceImportEvidenceMemo(`Owner-approved opening balances
Import obimp_1234abcd, rows 2, debit 100.0000, credit 40.2500, net 59.7500`)).toEqual({
      fingerprint: "obimp_1234abcd",
      rowCount: 2,
      totalDebit: "100.0000",
      totalCredit: "40.2500",
      netDifference: "59.7500",
    });
  });

  it("ignores memos without valid posted import evidence", () => {
    expect(parseOpeningBalanceImportEvidenceMemo("Owner-approved opening balances")).toBeNull();
    expect(parseOpeningBalanceImportEvidenceMemo("Import bad, rows 2, debit 100.0000, credit 0.0000, net 100.0000")).toBeNull();
  });

  it("rejects unknown accounts, malformed amounts, and dual-sided rows", () => {
    const result = parseOpeningBalanceCsv(`9999,Unknown,10,0
1010,Bad precision,10.12345,0
2200,Dual sided,5,5`, accounts);

    expect(result.rows).toEqual([]);
    expect(result.summary.rowCount).toBe(0);
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0]).toContain("9999");
    expect(result.errors[1]).toContain("Amounts must be non-negative");
    expect(result.errors[2]).toContain("exactly one positive debit or credit");
  });

  it("requires at least one row", () => {
    const result = parseOpeningBalanceCsv("", accounts);
    expect(result.errors).toEqual(["Paste at least one opening-balance row."]);
    expect(result.summary).toMatchObject({ rowCount: 0, totalDebit: "0.0000", totalCredit: "0.0000" });
  });
});
