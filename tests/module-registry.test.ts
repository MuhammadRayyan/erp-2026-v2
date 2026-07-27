import { describe, expect, it } from "vitest";
import { moduleRegistry } from "../src/modules/core/module-registry";
import { duplicateModuleKeys } from "../src/modules/core/module-registry.test-helper";

describe("module registry", () => {
  it("has unique module keys", () => {
    expect(duplicateModuleKeys()).toEqual([]);
  });

  it("declares permission and entitlement for every module", () => {
    for (const module of moduleRegistry) {
      expect(module.permission).toMatch(/^[a-z]+\.[a-z]+$/);
      expect(module.entitlement).toMatch(/^[a-z]+\.[a-z]+$/);
      expect(module.href.startsWith("/")).toBe(true);
    }
  });
});
