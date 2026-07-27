import { describe, expect, it } from "vitest";
import { moduleRegistry } from "../src/modules/core/module-registry";
import { duplicateModuleKeys } from "../src/modules/core/module-registry.test-helper";

describe("module registry", () => {
  it("has unique module keys", () => {
    expect(duplicateModuleKeys()).toEqual([]);
  });

  it("declares permission and entitlement for every module", () => {
    for (const entry of moduleRegistry) {
      expect(entry.permission).toMatch(/^[a-z]+\.[a-z]+$/);
      expect(entry.entitlement).toMatch(/^[a-z]+\.[a-z]+$/);
      expect(entry.href.startsWith("/")).toBe(true);
    }
  });
});
