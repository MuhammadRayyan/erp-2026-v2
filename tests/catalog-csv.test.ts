import { describe, expect, it } from "vitest";
import { csvRecords, parseCsv } from "../src/modules/catalog/imports/csv";

describe("catalog CSV parser", () => {
  it("parses quoted commas, escaped quotes, and embedded newlines", () => {
    expect(parseCsv('sku,name,description\nA1,"Brake, Pad","Line one\nLine ""two"""')).toEqual([
      ["sku", "name", "description"],
      ["A1", "Brake, Pad", 'Line one\nLine "two"'],
    ]);
  });

  it("maps header values and preserves source row numbers", () => {
    expect(csvRecords("sku,name\nA1,Brake Pad\nA2,Labour")).toEqual([
      { rowNumber: 2, data: { sku: "A1", name: "Brake Pad" } },
      { rowNumber: 3, data: { sku: "A2", name: "Labour" } },
    ]);
  });

  it("rejects unclosed quotes and duplicate headers", () => {
    expect(() => parseCsv('sku,name\nA1,"Broken')).toThrow("CATALOG_IMPORT_UNCLOSED_QUOTE");
    expect(() => csvRecords("sku,sku\nA1,A2")).toThrow("CATALOG_IMPORT_DUPLICATE_HEADERS");
  });
});
