import { describe, expect, it } from "vitest";
import { moduleRegistry } from "../src/modules/core/module-registry";
import { duplicateModuleKeys } from "../src/modules/core/module-registry.test-helper";
import { booleanFeatureKeys } from "../src/modules/entitlements/catalog";

const expectedPhaseByModule = {
  dashboard: 1,
  parties: 3,
  catalog: 3,
  files: 3,
  exports: 3,
  settings: 3,
  accounting: 4,
  sales: 6,
  purchases: 7,
  banking: 8,
  inventory: 10,
  projects: 11,
  reports: 13,
} as const;

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

  it("stays aligned with the authoritative phase roadmap", () => {
    expect(Object.fromEntries(moduleRegistry.map((entry) => [entry.key, entry.phase]))).toEqual(expectedPhaseByModule);
  });
});
