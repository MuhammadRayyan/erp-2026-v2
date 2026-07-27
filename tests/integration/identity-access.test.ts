import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { MembershipStatus } from "../../src/generated/prisma/client";
import { db } from "../../src/lib/db";
import { hasBusinessCapability } from "../../src/modules/access/roles";
import {
  getBusinessProfile,
  updateBusinessProfile,
} from "../../src/modules/business-settings/server/business-profile";
import {
  requireTenantCapacity,
  resolveTenantEntitlements,
} from "../../src/modules/entitlements/server/resolve";
import { resolveBusinessAccessContext } from "../../src/modules/tenancy/server/context";
import {
  acceptTenantInvitation,
  createTenantInvitation,
} from "../../src/modules/tenancy/server/invitations";
import { onboardOwner } from "../../src/modules/tenancy/server/onboarding";

async function createUser(label: string) {
  const suffix = randomUUID();

  return db.user.create({
    data: {
      id: randomUUID(),
      name: "Test Owner",
      email: `${label}-${suffix}@example.com`,
      emailVerified: true,
    },
  });
}

function testKey(label: string) {
  return `${label}-${randomUUID()}`;
}

describe("identity and business access foundation", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("creates one owner tenant, subscription, business, and profile idempotently", async () => {
    const user = await createUser("owner");
    const input = {
      idempotencyKey: testKey("onboarding-owner"),
      userId: user.id,
      tenantName: "Owner Account",
      businessLegalName: "Example Technical Services LLC",
    };

    const first = await onboardOwner(input);
    const second = await onboardOwner(input);

    expect(second.id).toBe(first.id);
    expect(await db.onboardingOperation.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(1);
    expect(await db.tenantMembership.count({ where: { tenantId: first.tenantId, userId: user.id } })).toBe(1);
    expect(await db.businessMembership.count({ where: { businessId: first.businessId, userId: user.id } })).toBe(1);
    expect(await db.tenantSubscription.count({ where: { tenantId: first.tenantId } })).toBe(1);
    expect(await db.businessProfile.count({ where: { tenantId: first.tenantId, businessId: first.businessId } })).toBe(1);
  });

  it("resolves access only through active tenant and business membership", async () => {
    const user = await createUser("member");
    const onboarding = await onboardOwner({
      idempotencyKey: testKey("onboarding-member"),
      userId: user.id,
      tenantName: "Member Account",
      businessLegalName: "Member Business LLC",
    });

    expect(
      await resolveBusinessAccessContext({
        userId: user.id,
        businessId: onboarding.businessId,
      }),
    ).toMatchObject({
      userId: user.id,
      tenantId: onboarding.tenantId,
      businessId: onboarding.businessId,
      roleKey: "business.owner",
      planKey: "internal-unlimited",
    });

    await db.businessMembership.update({
      where: {
        businessId_userId: {
          businessId: onboarding.businessId,
          userId: user.id,
        },
      },
      data: { status: MembershipStatus.DISABLED },
    });

    expect(
      await resolveBusinessAccessContext({
        userId: user.id,
        businessId: onboarding.businessId,
      }),
    ).toBeNull();
  });

  it("rejects a business membership that crosses tenant boundaries", async () => {
    const firstUser = await createUser("first");
    const secondUser = await createUser("second");
    const first = await onboardOwner({
      idempotencyKey: testKey("onboarding-cross-first"),
      userId: firstUser.id,
      tenantName: "First Tenant",
      businessLegalName: "First Business LLC",
    });
    const second = await onboardOwner({
      idempotencyKey: testKey("onboarding-cross-second"),
      userId: secondUser.id,
      tenantName: "Second Tenant",
      businessLegalName: "Second Business LLC",
    });

    await expect(
      db.businessMembership.create({
        data: {
          tenantId: first.tenantId,
          businessId: second.businessId,
          userId: firstUser.id,
          roleKey: "business.viewer",
        },
      }),
    ).rejects.toThrow();
  });

  it("accepts a tenant invitation only for the invited email and granted business", async () => {
    const owner = await createUser("invite-owner");
    const invited = await createUser("invite-member");
    const wrongUser = await createUser("invite-wrong");
    const onboarding = await onboardOwner({
      idempotencyKey: testKey("onboarding-invite"),
      userId: owner.id,
      tenantName: "Invitation Tenant",
      businessLegalName: "Invitation Business LLC",
    });

    const created = await createTenantInvitation({
      actorUserId: owner.id,
      tenantId: onboarding.tenantId,
      email: invited.email,
      expiresInDays: 7,
      businessGrants: [{ businessId: onboarding.businessId, roleKey: "business.accountant" }],
    });

    await expect(
      acceptTenantInvitation({
        userId: wrongUser.id,
        userEmail: wrongUser.email,
        token: created.token,
      }),
    ).rejects.toThrow("INVITATION_EMAIL_MISMATCH");

    const accepted = await acceptTenantInvitation({
      userId: invited.id,
      userEmail: invited.email,
      token: created.token,
    });

    expect(accepted.businessGrants).toHaveLength(1);
    expect(
      await resolveBusinessAccessContext({
        userId: invited.id,
        businessId: onboarding.businessId,
      }),
    ).toMatchObject({ roleKey: "business.accountant" });
  });

  it("prevents a tenant owner from granting a business from another tenant", async () => {
    const firstOwner = await createUser("grant-first");
    const secondOwner = await createUser("grant-second");
    const first = await onboardOwner({
      idempotencyKey: testKey("grant-first"),
      userId: firstOwner.id,
      tenantName: "Grant First",
      businessLegalName: "Grant First LLC",
    });
    const second = await onboardOwner({
      idempotencyKey: testKey("grant-second"),
      userId: secondOwner.id,
      tenantName: "Grant Second",
      businessLegalName: "Grant Second LLC",
    });

    await expect(
      createTenantInvitation({
        actorUserId: firstOwner.id,
        tenantId: first.tenantId,
        email: `cross-${randomUUID()}@example.com`,
        expiresInDays: 7,
        businessGrants: [{ businessId: second.businessId, roleKey: "business.viewer" }],
      }),
    ).rejects.toThrow("INVALID_BUSINESS_GRANT");
  });

  it("resolves plan features and applies tenant overrides", async () => {
    const owner = await createUser("entitlement-owner");
    const onboarding = await onboardOwner({
      idempotencyKey: testKey("entitlement-onboarding"),
      userId: owner.id,
      tenantName: "Entitlement Tenant",
      businessLegalName: "Entitlement Business LLC",
    });

    const initial = await resolveTenantEntitlements(onboarding.tenantId);
    expect(initial.plan.key).toBe("internal-unlimited");
    expect(initial.enabledFeatures.has("core.dashboard")).toBe(true);
    expect(initial.limits.get("limit.users")).toBeNull();

    const settingsFeature = await db.featureDefinition.findUniqueOrThrow({ where: { key: "core.settings" } });
    const usersLimit = await db.featureDefinition.findUniqueOrThrow({ where: { key: "limit.users" } });
    await db.tenantEntitlementOverride.createMany({
      data: [
        { tenantId: onboarding.tenantId, featureId: settingsFeature.id, enabled: false },
        { tenantId: onboarding.tenantId, featureId: usersLimit.id, limitValue: 1 },
      ],
    });

    const overridden = await resolveTenantEntitlements(onboarding.tenantId);
    expect(overridden.enabledFeatures.has("core.settings")).toBe(false);
    expect(overridden.limits.get("limit.users")).toBe(1);
    await expect(
      requireTenantCapacity({
        tenantId: onboarding.tenantId,
        limitKey: "limit.users",
        currentUsage: 1,
      }),
    ).rejects.toThrow("TENANT_LIMIT_REACHED");
  });

  it("updates a tenant-scoped UAE business profile with registered VAT details", async () => {
    const owner = await createUser("profile-owner");
    const onboarding = await onboardOwner({
      idempotencyKey: testKey("profile-onboarding"),
      userId: owner.id,
      tenantName: "Profile Tenant",
      businessLegalName: "Profile Technical Services LLC",
    });
    const context = await resolveBusinessAccessContext({ userId: owner.id, businessId: onboarding.businessId });
    expect(context).not.toBeNull();

    const updated = await updateBusinessProfile(context!, {
      industryProfile: "TECHNICAL_SERVICES",
      legalForm: "Limited Liability Company",
      tradeLicenseNumber: "CN-1234567",
      tradeLicenseAuthority: "Abu Dhabi Department of Economic Development",
      vatRegistrationStatus: "REGISTERED",
      trn: "100000000000003",
      vatEffectiveFrom: "2026-01-01",
      fiscalYearStartMonth: 1,
      documentLanguage: "BILINGUAL",
    });

    expect(updated).toMatchObject({
      industryProfile: "TECHNICAL_SERVICES",
      vatRegistrationStatus: "REGISTERED",
      trn: "100000000000003",
      documentLanguage: "BILINGUAL",
    });
    expect((await getBusinessProfile(context!)).profile?.trn).toBe("100000000000003");
  });

  it("rejects incomplete VAT registration and read-only profile changes", async () => {
    const owner = await createUser("profile-guard-owner");
    const viewer = await createUser("profile-guard-viewer");
    const onboarding = await onboardOwner({
      idempotencyKey: testKey("profile-guard-onboarding"),
      userId: owner.id,
      tenantName: "Profile Guard Tenant",
      businessLegalName: "Profile Guard LLC",
    });
    const ownerContext = await resolveBusinessAccessContext({ userId: owner.id, businessId: onboarding.businessId });

    await expect(updateBusinessProfile(ownerContext!, {
      industryProfile: "GENERAL_SERVICES",
      legalForm: "LLC",
      tradeLicenseNumber: "123",
      tradeLicenseAuthority: "Authority",
      vatRegistrationStatus: "REGISTERED",
      trn: "123",
      vatEffectiveFrom: null,
      fiscalYearStartMonth: 1,
      documentLanguage: "ENGLISH",
    })).rejects.toThrow();

    await db.tenantMembership.create({
      data: { tenantId: onboarding.tenantId, userId: viewer.id, status: MembershipStatus.ACTIVE },
    });
    await db.businessMembership.create({
      data: {
        tenantId: onboarding.tenantId,
        businessId: onboarding.businessId,
        userId: viewer.id,
        roleKey: "business.viewer",
        status: MembershipStatus.ACTIVE,
      },
    });
    const viewerContext = await resolveBusinessAccessContext({ userId: viewer.id, businessId: onboarding.businessId });
    await expect(updateBusinessProfile(viewerContext!, {
      industryProfile: null,
      legalForm: null,
      tradeLicenseNumber: null,
      tradeLicenseAuthority: null,
      vatRegistrationStatus: "NOT_REGISTERED",
      trn: null,
      vatEffectiveFrom: null,
      fiscalYearStartMonth: 1,
      documentLanguage: "ENGLISH",
    })).rejects.toThrow("BUSINESS_CAPABILITY_DENIED");
  });

  it("maps practical roles to capabilities without granting management by default", () => {
    expect(hasBusinessCapability("business.accountant", "accounting.manage")).toBe(true);
    expect(hasBusinessCapability("business.viewer", "accounting.manage")).toBe(false);
    expect(hasBusinessCapability("business.technician", "settings.manage")).toBe(false);
    expect(hasBusinessCapability("unknown-role", "dashboard.view")).toBe(false);
  });
});
