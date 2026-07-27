import { describe, expect, it } from "vitest";
import { onboardingRequestSchema } from "../src/modules/tenancy/contracts/onboarding-request";

describe("onboarding request contract", () => {
  it("applies UAE-first defaults", () => {
    const result = onboardingRequestSchema.parse({
      tenantName: "Owner Group",
      businessLegalName: "Example Technical Services LLC",
    });

    expect(result).toMatchObject({
      baseCurrency: "AED",
      timezone: "Asia/Dubai",
    });
  });

  it("rejects unsupported currencies and empty names", () => {
    expect(() => onboardingRequestSchema.parse({
      tenantName: "",
      businessLegalName: "A",
      baseCurrency: "GBP",
    })).toThrow();
  });
});
