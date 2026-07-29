import { EmailOutboxStatus, InvitationStatus, MembershipStatus, TenantStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getBusinessRole } from "@/modules/access/roles";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";

async function requireTenantOwner(actorUserId: string, tenantId: string) {
  const owner = await db.tenantMembership.findFirst({
    where: { tenantId, userId: actorUserId, status: MembershipStatus.ACTIVE, isOwner: true, tenant: { status: TenantStatus.ACTIVE } },
    select: { id: true },
  });
  if (!owner) throw new Error("TENANT_OWNER_REQUIRED");
}

async function requireTenantAccessAdministration(actorUserId: string, tenantId: string) {
  await requireTenantOwner(actorUserId, tenantId);
  await requireTenantFeature(tenantId, "users.manage");
}

export async function updateTenantMemberAccess(input: {
  actorUserId: string;
  tenantId: string;
  targetUserId: string;
  status?: "ACTIVE" | "DISABLED";
  businessGrants?: Array<{ businessId: string; roleKey: string; status: "ACTIVE" | "DISABLED" }>;
}) {
  await requireTenantAccessAdministration(input.actorUserId, input.tenantId);
  const membership = await db.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId: input.tenantId, userId: input.targetUserId } },
    select: { id: true, isOwner: true, status: true },
  });
  if (!membership) throw new Error("TENANT_MEMBER_NOT_FOUND");
  if (membership.isOwner && input.status === "DISABLED") throw new Error("TENANT_OWNER_PROTECTED");

  const grants = input.businessGrants ?? [];
  for (const grant of grants) {
    const role = getBusinessRole(grant.roleKey);
    if (!role || role.key === "business.owner") throw new Error("INVALID_BUSINESS_ROLE");
  }
  const businessIds = grants.map((grant) => grant.businessId);
  if (businessIds.length > 0) {
    const businessCount = await db.business.count({ where: { tenantId: input.tenantId, id: { in: businessIds } } });
    if (businessCount !== new Set(businessIds).size) throw new Error("INVALID_BUSINESS_GRANT");
  }

  return db.$transaction(async (transaction) => {
    if (input.status) {
      await transaction.tenantMembership.update({
        where: { tenantId_userId: { tenantId: input.tenantId, userId: input.targetUserId } },
        data: { status: input.status as MembershipStatus },
      });
      if (input.status === "DISABLED") {
        await transaction.businessMembership.updateMany({ where: { tenantId: input.tenantId, userId: input.targetUserId }, data: { status: MembershipStatus.DISABLED } });
        await transaction.session.deleteMany({ where: { userId: input.targetUserId } });
      }
    }
    for (const grant of grants) {
      await transaction.businessMembership.upsert({
        where: { businessId_userId: { businessId: grant.businessId, userId: input.targetUserId } },
        update: { roleKey: grant.roleKey, status: grant.status as MembershipStatus },
        create: { tenantId: input.tenantId, businessId: grant.businessId, userId: input.targetUserId, roleKey: grant.roleKey, status: grant.status as MembershipStatus },
      });
    }
    return transaction.tenantMembership.findUniqueOrThrow({
      where: { tenantId_userId: { tenantId: input.tenantId, userId: input.targetUserId } },
      include: { businesses: true },
    });
  });
}

export async function revokeTenantInvitation(input: { actorUserId: string; tenantId: string; invitationId: string }) {
  await requireTenantAccessAdministration(input.actorUserId, input.tenantId);
  return db.$transaction(async (transaction) => {
    const result = await transaction.tenantInvitation.updateMany({
      where: { id: input.invitationId, tenantId: input.tenantId, status: InvitationStatus.PENDING },
      data: { status: InvitationStatus.REVOKED },
    });
    if (result.count !== 1) throw new Error("INVITATION_NOT_FOUND");
    await transaction.emailOutbox.updateMany({
      where: {
        tenantId: input.tenantId,
        correlationType: "TENANT_INVITATION",
        correlationId: input.invitationId,
        status: { in: [EmailOutboxStatus.PENDING, EmailOutboxStatus.RETRY] },
      },
      data: { status: EmailOutboxStatus.CANCELLED, textBody: null, htmlBody: null, lastError: "INVITATION_REVOKED" },
    });
  });
}
