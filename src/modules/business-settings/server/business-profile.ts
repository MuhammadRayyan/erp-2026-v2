import { db } from "@/lib/db";
import { requireBusinessCapability } from "@/modules/access/server/authorize";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";
import type { BusinessAccessContext } from "@/modules/tenancy/server/context";
import {
  businessProfileInputSchema,
  type BusinessProfileInput,
} from "@/modules/business-settings/contracts/business-profile";

export async function getBusinessProfile(context: BusinessAccessContext) {
  requireBusinessCapability(context, "settings.view");
  await requireTenantFeature(context.tenantId, "core.settings");

  return db.business.findUniqueOrThrow({
    where: {
      tenantId_id: {
        tenantId: context.tenantId,
        id: context.businessId,
      },
    },
    select: {
      id: true,
      legalName: true,
      tradingName: true,
      countryCode: true,
      baseCurrency: true,
      timezone: true,
      profile: true,
    },
  });
}

export async function updateBusinessProfile(
  context: BusinessAccessContext,
  rawInput: BusinessProfileInput,
) {
  requireBusinessCapability(context, "settings.manage");
  await requireTenantFeature(context.tenantId, "core.settings");
  const input = businessProfileInputSchema.parse(rawInput);

  return db.businessProfile.upsert({
    where: {
      tenantId_businessId: {
        tenantId: context.tenantId,
        businessId: context.businessId,
      },
    },
    update: {
      industryProfile: input.industryProfile,
      legalForm: input.legalForm,
      tradeLicenseNumber: input.tradeLicenseNumber,
      tradeLicenseAuthority: input.tradeLicenseAuthority,
      vatRegistrationStatus: input.vatRegistrationStatus,
      trn: input.vatRegistrationStatus === "NOT_REGISTERED" ? null : input.trn,
      vatEffectiveFrom: input.vatEffectiveFrom ? new Date(`${input.vatEffectiveFrom}T00:00:00.000Z`) : null,
      fiscalYearStartMonth: input.fiscalYearStartMonth,
      documentLanguage: input.documentLanguage,
    },
    create: {
      tenantId: context.tenantId,
      businessId: context.businessId,
      industryProfile: input.industryProfile,
      legalForm: input.legalForm,
      tradeLicenseNumber: input.tradeLicenseNumber,
      tradeLicenseAuthority: input.tradeLicenseAuthority,
      vatRegistrationStatus: input.vatRegistrationStatus,
      trn: input.vatRegistrationStatus === "NOT_REGISTERED" ? null : input.trn,
      vatEffectiveFrom: input.vatEffectiveFrom ? new Date(`${input.vatEffectiveFrom}T00:00:00.000Z`) : null,
      fiscalYearStartMonth: input.fiscalYearStartMonth,
      documentLanguage: input.documentLanguage,
    },
  });
}
