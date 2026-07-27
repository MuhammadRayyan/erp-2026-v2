import { describe, expect, it } from "vitest";
import { moduleRegistry } from "../src/modules/core/module-registry";
import { duplicateModuleKeys } from "../src/modules/core/module-registry.test-helper";
import { booleanFeatureKeys } from "../src/modules/entitlements/catalog";

describe("module registry", () => {
  it("has unique module keys", () => {
    expect(duplicateModuleKeys()).toEqual([]);
  });

  it("declares permission and registered entitlement for every module", () => {
    const registeredFeatures = new Set<string>(booleanFeatureKeys);
    for (const entry of moduleRegistry) {
      expect(entry.permission).toMatch(/^[a-z]+\.[a-z]+$/);
      expect(entry.entitlement).toMatch(/^[a-z]+\.[a-z]+$/);
      expect(registeredFeatures.has(entry.entitlement)).toBe(true);
      expect(entry.href.startsWith("/")).toBe(true);
    }
  });
});
