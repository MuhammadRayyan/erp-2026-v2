import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { InvitationStatus, MembershipStatus } from "../../src/generated/prisma/client";
import { db } from "../../src/lib/db";
import { createTenantInvitation } from "../../src/modules/tenancy/server/invitations";
import { revokeTenantInvitation, updateTenantMemberAccess } from "../../src/modules/tenancy/server/member-access";
import { onboardOwner } from "../../src/modules/tenancy/server/onboarding";

async function createUser(label: string) {
  const id = randomUUID();
  return db.user.create({
    data: {
      id,
      name: label,
      email: `${label.toLowerCase()}-${id}@example.com`,
      emailVerified: true,
    },
  });
}

async function setupTenant() {
  const owner = await createUser("Owner");
  const onboarding = await onboardOwner({
    idempotencyKey: `member-management-${randomUUID()}`,
    userId: owner.id,
    tenantName: "Access Test Tenant",
    businessLegalName: "Access Test Business LLC",
  });
  return { owner, onboarding };
}

describe("tenant member management", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("protects the tenant owner from disablement", async () => {
    const { owner, onboarding } = await setupTenant();

    await expect(updateTenantMemberAccess({
      actorUserId: owner.id,
      tenantId: onboarding.tenantId,
      targetUserId: owner.id,
      status: "DISABLED",
    })).rejects.toThrow("TENANT_OWNER_PROTECTED");
  });

  it("changes a member role and revokes sessions when disabling access", async () => {
    const { owner, onboarding } = await setupTenant();
    const member = await createUser("Member");

    await db.tenantMembership.create({
      data: {
        tenantId: onboarding.tenantId,
        userId: member.id,
        status: MembershipStatus.ACTIVE,
      },
    });
    await db.businessMembership.create({
      data: {
        tenantId: onboarding.tenantId,
        businessId: onboarding.businessId,
        userId: member.id,
        roleKey: "business.viewer",
      },
    });
    await db.session.create({
      data: {
        id: randomUUID(),
        userId: member.id,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await updateTenantMemberAccess({
      actorUserId: owner.id,
      tenantId: onboarding.tenantId,
      targetUserId: member.id,
      businessGrants: [{
        businessId: onboarding.businessId,
        roleKey: "business.accountant",
        status: "ACTIVE",
      }],
    });

    expect(await db.businessMembership.findUnique({
      where: { businessId_userId: { businessId: onboarding.businessId, userId: member.id } },
      select: { roleKey: true },
    })).toEqual({ roleKey: "business.accountant" });

    await updateTenantMemberAccess({
      actorUserId: owner.id,
      tenantId: onboarding.tenantId,
      targetUserId: member.id,
      status: "DISABLED",
    });

    expect(await db.session.count({ where: { userId: member.id } })).toBe(0);
    expect(await db.businessMembership.findUnique({
      where: { businessId_userId: { businessId: onboarding.businessId, userId: member.id } },
      select: { status: true },
    })).toEqual({ status: MembershipStatus.DISABLED });
  });

  it("revokes only a pending invitation in the same tenant", async () => {
    const { owner, onboarding } = await setupTenant();
    const invitation = await createTenantInvitation({
      actorUserId: owner.id,
      tenantId: onboarding.tenantId,
      email: `invite-${randomUUID()}@example.com`,
      expiresInDays: 7,
      businessGrants: [{ businessId: onboarding.businessId, roleKey: "business.viewer" }],
    });

    await revokeTenantInvitation({
      actorUserId: owner.id,
      tenantId: onboarding.tenantId,
      invitationId: invitation.invitation.id,
    });

    expect(await db.tenantInvitation.findUnique({
      where: { id: invitation.invitation.id },
      select: { status: true },
    })).toEqual({ status: InvitationStatus.REVOKED });
  });
});
