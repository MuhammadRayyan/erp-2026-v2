import { describe, expect, it } from "vitest";
import { serializeCsv } from "../src/modules/exports/csv";
import { EXPORT_ROW_LIMIT } from "../src/modules/exports/datasets";
import { assertExportRowLimit } from "../src/modules/exports/server/exports";

describe("CSV exports", () => {
  it("writes deterministic UTF-8 CSV with quoting and spreadsheet formula neutralization", () => {
    const csv = serializeCsv(
      ["Name", "Note", "Amount", "Active"],
      [["=SUM(A1:A2)", "comma, quote \" and\nline", -12.5, true], ["@command", null, 0, false]],
    );
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("'=SUM(A1:A2)");
    expect(csv).toContain("'@command");
    expect(csv).toContain('"comma, quote "" and\nline"');
    expect(csv).toContain(",-12.5,true");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("rejects results above the synchronous row ceiling", () => {
    expect(() => assertExportRowLimit(EXPORT_ROW_LIMIT)).not.toThrow();
    expect(() => assertExportRowLimit(EXPORT_ROW_LIMIT + 1)).toThrow("EXPORT_ROW_LIMIT_EXCEEDED");
  });
});
