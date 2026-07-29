import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { createAccountingPeriod } from "../../src/modules/accounting/server/periods";
import { updateBusinessProfile } from "../../src/modules/business-settings/server/business-profile";
import { onboardOwner } from "../../src/modules/tenancy/server/onboarding";
import { requireBusinessAccessContext } from "../../src/modules/tenancy/server/context";

async function setupBusiness() {
  const userId = randomUUID();
  await db.user.create({
    data: {
      id: userId,
      name: "Fiscal Settings Owner",
      email: `fiscal-settings-${userId}@example.com`,
      emailVerified: true,
    },
  });
  const onboarding = await onboardOwner({
    idempotencyKey: `fiscal-settings-${randomUUID()}`,
    userId,
    tenantName: "Fiscal Settings Tenant",
    businessLegalName: "Fiscal Settings Business LLC",
  });
  const context = await requireBusinessAccessContext({ userId, businessId: onboarding.businessId });
  return { context };
}

const profileInput = {
  industryProfile: "GENERAL_SERVICES" as const,
  legalForm: null,
  tradeLicenseNumber: null,
  tradeLicenseAuthority: null,
  vatRegistrationStatus: "NOT_REGISTERED" as const,
  trn: null,
  vatEffectiveFrom: null,
  fiscalYearStartMonth: 1,
  documentLanguage: "ENGLISH" as const,
};

describe("accounting period fiscal settings", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("allows fiscal-year configuration before periods and locks it afterward", async () => {
    const { context } = await setupBusiness();
    const configured = await updateBusinessProfile(context, { ...profileInput, fiscalYearStartMonth: 4 });
    expect(configured.fiscalYearStartMonth).toBe(4);

    await createAccountingPeriod(context, {
      name: "FY 2026-27",
      startDate: "2026-04-01",
      endDate: "2027-03-31",
    });

    await expect(updateBusinessProfile(context, { ...profileInput, fiscalYearStartMonth: 1 })).rejects.toThrow("BUSINESS_FISCAL_YEAR_LOCKED_BY_PERIODS");
    expect((await db.businessProfile.findUniqueOrThrow({ where: { businessId: context.businessId } })).fiscalYearStartMonth).toBe(4);
  });
});
