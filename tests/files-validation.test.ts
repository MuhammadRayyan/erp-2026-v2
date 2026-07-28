import { describe, expect, it } from "vitest";
import { createStorageKey, validatePrivateFile } from "../src/modules/files/storage/validation";

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]);

describe("private file validation", () => {
  it("accepts an allowlisted file with a matching signature", () => {
    const result = validatePrivateFile({ name: "Trade License.pdf", contentType: "application/pdf", bytes: pdf, maxBytes: 1024 });
    expect(result.safeName).toBe("Trade License.pdf");
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects extension and signature mismatches", () => {
    expect(() => validatePrivateFile({ name: "invoice.pdf", contentType: "application/pdf", bytes: new Uint8Array([1, 2, 3]), maxBytes: 1024 })).toThrow("FILE_SIGNATURE_MISMATCH");
    expect(() => validatePrivateFile({ name: "script.exe", contentType: "application/octet-stream", bytes: pdf, maxBytes: 1024 })).toThrow("FILE_EXTENSION_NOT_ALLOWED");
  });

  it("generates tenant and business scoped opaque keys", () => {
    const key = createStorageKey({ tenantId: "tenant-a", businessId: "business-a", extension: "pdf" });
    expect(key).toMatch(/^tenant-a\/business-a\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]+\.pdf$/);
    expect(key).not.toContain("Trade License");
  });
});
