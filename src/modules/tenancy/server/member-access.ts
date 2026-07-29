import { EmailOutboxStatus, InvitationStatus, MembershipStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getBusinessRole } from "@/modules/access/roles";
import { requireTenantAccessAdministration } from "@/modules/tenancy/server/access-admin";
import { appendTenantAccessEvent } from "@/modules/tenancy/server/access-audit";

export async function updateTenantMemberAccess(input: {
  actorUserId: string;
  tenantId: string;
  targetUserId: string;
  status?: "ACTIVE" | "DISABLED";
  businessGrants?: Array<{ businessId: string; roleKey: string; status: "ACTIVE" | "DISABLED" }>;
}) {
  await requireTenantAccessAdministration(input.actorUserId, input.tenantId);
  const grants = input.businessGrants ?? [];
  if (input.status === "DISABLED" && grants.some((grant) => grant.status === "ACTIVE")) {
    throw new Error("TENANT_MEMBER_GRANT_CONFLICT");
  }
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
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "TenantMembership"
      WHERE "tenantId" = ${input.tenantId} AND "userId" = ${input.targetUserId}
      FOR UPDATE
    `;
    if (!locked[0]) throw new Error("TENANT_MEMBER_NOT_FOUND");
    const membership = await transaction.tenantMembership.findUniqueOrThrow({
      where: { tenantId_userId: { tenantId: input.tenantId, userId: input.targetUserId } },
      include: {
        user: { select: { email: true } },
        businesses: { select: { businessId: true, roleKey: true, status: true } },
      },
    });
    if (membership.isOwner && input.status === "DISABLED") throw new Error("TENANT_OWNER_PROTECTED");
    const targetEmail = membership.user.email;
    const existingByBusiness = new Map(membership.businesses.map((grant) => [grant.businessId, grant]));

    if (input.status && membership.status !== input.status) {
      await transaction.tenantMembership.update({
        where: { tenantId_userId: { tenantId: input.tenantId, userId: input.targetUserId } },
        data: { status: input.status as MembershipStatus },
      });
      await appendTenantAccessEvent(transaction, {
        tenantId: input.tenantId,
        eventType: input.status === "ACTIVE" ? "MEMBER_ACTIVATED" : "MEMBER_DISABLED",
        actorUserId: input.actorUserId,
        targetUserId: input.targetUserId,
        targetEmail,
        summary: input.status === "ACTIVE" ? "Tenant member reactivated" : "Tenant member disabled",
        metadata: { previousStatus: membership.status, status: input.status, source: "ADMINISTRATION" },
      });

      if (input.status === "DISABLED") {
        const activeGrants = membership.businesses.filter((grant) => grant.status === MembershipStatus.ACTIVE);
        await transaction.businessMembership.updateMany({
          where: { tenantId: input.tenantId, userId: input.targetUserId, status: MembershipStatus.ACTIVE },
          data: { status: MembershipStatus.DISABLED },
        });
        for (const grant of activeGrants) {
          await appendTenantAccessEvent(transaction, {
            tenantId: input.tenantId,
            eventType: "BUSINESS_ACCESS_DISABLED",
            actorUserId: input.actorUserId,
            targetUserId: input.targetUserId,
            targetEmail,
            businessId: grant.businessId,
            summary: "Business access disabled",
            metadata: { roleKey: grant.roleKey, previousStatus: grant.status, status: MembershipStatus.DISABLED, source: "MEMBER_DISABLED" },
          });
          existingByBusiness.set(grant.businessId, { ...grant, status: MembershipStatus.DISABLED });
        }
        const revokedSessions = await transaction.session.deleteMany({ where: { userId: input.targetUserId } });
        await appendTenantAccessEvent(transaction, {
          tenantId: input.tenantId,
          eventType: "SESSIONS_REVOKED",
          actorUserId: input.actorUserId,
          targetUserId: input.targetUserId,
          targetEmail,
          summary: "Member sessions revoked",
          metadata: { count: revokedSessions.count, source: "MEMBER_DISABLED" },
        });
      }
    }

    for (const grant of grants) {
      const existing = existingByBusiness.get(grant.businessId);
      await transaction.businessMembership.upsert({
        where: { businessId_userId: { businessId: grant.businessId, userId: input.targetUserId } },
        update: { roleKey: grant.roleKey, status: grant.status as MembershipStatus },
        create: { tenantId: input.tenantId, businessId: grant.businessId, userId: input.targetUserId, roleKey: grant.roleKey, status: grant.status as MembershipStatus },
      });
      if (!existing) {
        await appendTenantAccessEvent(transaction, {
          tenantId: input.tenantId,
          eventType: "BUSINESS_ACCESS_GRANTED",
          actorUserId: input.actorUserId,
          targetUserId: input.targetUserId,
          targetEmail,
          businessId: grant.businessId,
          summary: "Business access granted",
          metadata: { roleKey: grant.roleKey, status: grant.status, source: "ADMINISTRATION" },
        });
      } else if (existing.roleKey !== grant.roleKey || existing.status !== grant.status) {
        const eventType = existing.status === MembershipStatus.ACTIVE && grant.status === "DISABLED"
          ? "BUSINESS_ACCESS_DISABLED"
          : "BUSINESS_ACCESS_UPDATED";
        await appendTenantAccessEvent(transaction, {
          tenantId: input.tenantId,
          eventType,
          actorUserId: input.actorUserId,
          targetUserId: input.targetUserId,
          targetEmail,
          businessId: grant.businessId,
          summary: eventType === "BUSINESS_ACCESS_DISABLED" ? "Business access disabled" : "Business access updated",
          metadata: {
            previousRoleKey: existing.roleKey,
            roleKey: grant.roleKey,
            previousStatus: existing.status,
            status: grant.status,
            source: "ADMINISTRATION",
          },
        });
      }
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
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "TenantInvitation"
      WHERE "id" = ${input.invitationId} AND "tenantId" = ${input.tenantId}
      FOR UPDATE
    `;
    if (!locked[0]) throw new Error("INVITATION_NOT_FOUND");
    const invitation = await transaction.tenantInvitation.findUnique({
      where: { id: input.invitationId },
      select: { id: true, email: true, status: true, businessGrants: { select: { businessId: true, roleKey: true } } },
    });
    if (!invitation || invitation.status !== InvitationStatus.PENDING) throw new Error("INVITATION_NOT_FOUND");
    await transaction.tenantInvitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.REVOKED },
    });
    await transaction.emailOutbox.updateMany({
      where: {
        tenantId: input.tenantId,
        correlationType: "TENANT_INVITATION",
        correlationId: input.invitationId,
        status: { in: [EmailOutboxStatus.PENDING, EmailOutboxStatus.RETRY] },
      },
      data: { status: EmailOutboxStatus.CANCELLED, textBody: null, htmlBody: null, lastError: "INVITATION_REVOKED" },
    });
    await appendTenantAccessEvent(transaction, {
      tenantId: input.tenantId,
      eventType: "INVITATION_REVOKED",
      actorUserId: input.actorUserId,
      targetEmail: invitation.email,
      invitationId: invitation.id,
      summary: "Invitation revoked",
      metadata: { businessGrants: invitation.businessGrants },
    });
  });
}
