import { createHash, randomBytes } from "node:crypto";
import { EmailOutboxCategory, EmailOutboxStatus, InvitationStatus, MembershipStatus, TenantStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/server-env";
import { getBusinessRole } from "@/modules/access/roles";
import { enqueueEmail } from "@/modules/communication/server/email-outbox";
import { escapeEmailHtml } from "@/modules/communication/server/platform-email";
import { requireTenantUserInvitationCapacityInTransaction } from "@/modules/entitlements/server/usage";
import { requireTenantAccessAdministration } from "@/modules/tenancy/server/access-admin";
import { appendTenantAccessEvent } from "@/modules/tenancy/server/access-audit";

function digestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function grantSnapshot(grants: Array<{ businessId: string; roleKey: string }>) {
  return grants.map((grant) => ({ businessId: grant.businessId, roleKey: grant.roleKey }));
}

async function expirePendingInvitations(tenantId: string, now = new Date()) {
  return db.$transaction(async (transaction) => {
    const expired = await transaction.$queryRaw<Array<{ id: string; email: string }>>`
      UPDATE "TenantInvitation"
      SET "status" = 'EXPIRED'::"InvitationStatus", "updatedAt" = ${now}
      WHERE "tenantId" = ${tenantId}
        AND "status" = 'PENDING'::"InvitationStatus"
        AND "expiresAt" <= ${now}
      RETURNING "id", "email"
    `;
    if (expired.length === 0) return 0;
    const ids = expired.map(({ id }) => id);
    await transaction.emailOutbox.updateMany({
      where: {
        tenantId,
        correlationType: "TENANT_INVITATION",
        correlationId: { in: ids },
        status: { in: [EmailOutboxStatus.PENDING, EmailOutboxStatus.RETRY] },
      },
      data: { status: EmailOutboxStatus.EXPIRED, textBody: null, htmlBody: null, lastError: "INVITATION_EXPIRED" },
    });
    for (const invitation of expired) {
      await appendTenantAccessEvent(transaction, {
        tenantId,
        eventType: "INVITATION_EXPIRED",
        targetEmail: invitation.email,
        invitationId: invitation.id,
        summary: "Invitation expired",
        metadata: { source: "ADMINISTRATION_REFRESH" },
      });
    }
    return expired.length;
  });
}

export async function createTenantInvitation(input: {
  actorUserId: string;
  tenantId: string;
  email: string;
  expiresInDays: number;
  businessGrants: Array<{ businessId: string; roleKey: string }>;
}) {
  await requireTenantAccessAdministration(input.actorUserId, input.tenantId);
  for (const grant of input.businessGrants) {
    const role = getBusinessRole(grant.roleKey);
    if (!role || role.key === "business.owner") throw new Error("INVALID_BUSINESS_ROLE");
  }

  const businesses = await db.business.findMany({
    where: { tenantId: input.tenantId, id: { in: input.businessGrants.map((grant) => grant.businessId) } },
    select: { id: true },
  });
  if (businesses.length !== new Set(input.businessGrants.map((grant) => grant.businessId)).size) throw new Error("INVALID_BUSINESS_GRANT");

  const token = randomBytes(32).toString("base64url");
  const tokenDigest = digestToken(token);
  const normalizedEmail = input.email.trim().toLowerCase();
  const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);

  const invitation = await db.$transaction(async (transaction) => {
    await requireTenantUserInvitationCapacityInTransaction(transaction, input.tenantId, normalizedEmail);
    const superseded = await transaction.tenantInvitation.findMany({
      where: { tenantId: input.tenantId, email: normalizedEmail, status: InvitationStatus.PENDING },
      select: { id: true, email: true, businessGrants: { select: { businessId: true, roleKey: true } } },
    });
    const supersededIds = superseded.map((row) => row.id);
    if (supersededIds.length > 0) {
      await transaction.tenantInvitation.updateMany({
        where: { tenantId: input.tenantId, id: { in: supersededIds }, status: InvitationStatus.PENDING },
        data: { status: InvitationStatus.REVOKED },
      });
      await transaction.emailOutbox.updateMany({
        where: {
          tenantId: input.tenantId,
          correlationType: "TENANT_INVITATION",
          correlationId: { in: supersededIds },
          status: { in: [EmailOutboxStatus.PENDING, EmailOutboxStatus.RETRY] },
        },
        data: { status: EmailOutboxStatus.CANCELLED, textBody: null, htmlBody: null, lastError: "INVITATION_SUPERSEDED" },
      });
      for (const previous of superseded) {
        await appendTenantAccessEvent(transaction, {
          tenantId: input.tenantId,
          eventType: "INVITATION_SUPERSEDED",
          actorUserId: input.actorUserId,
          targetEmail: previous.email,
          invitationId: previous.id,
          summary: "Invitation superseded",
          metadata: { businessGrants: grantSnapshot(previous.businessGrants) },
        });
      }
    }

    const created = await transaction.tenantInvitation.create({
      data: {
        tenantId: input.tenantId,
        email: normalizedEmail,
        tokenDigest,
        expiresAt,
        invitedByUserId: input.actorUserId,
        businessGrants: {
          create: input.businessGrants.map((grant) => ({
            roleKey: grant.roleKey,
            business: { connect: { tenantId_id: { tenantId: input.tenantId, id: grant.businessId } } },
          })),
        },
      },
      include: {
        tenant: { select: { name: true } },
        invitedBy: { select: { name: true, email: true } },
        businessGrants: { include: { business: { select: { legalName: true } } } },
      },
    });

    const invitationUrl = `${serverEnv.APP_URL}/invitations/${token}`;
    const grants = created.businessGrants.map((grant) => `${grant.business.legalName}: ${grant.roleKey.replace("business.", "")}`).join("\n");
    await enqueueEmail(transaction, {
      tenantId: input.tenantId,
      category: EmailOutboxCategory.TENANT_INVITATION,
      recipient: created.email,
      subject: `Invitation to ${created.tenant.name}`,
      textBody: `${created.invitedBy.name} invited you to ${created.tenant.name}.\n\nBusiness access:\n${grants}\n\nAccept within ${input.expiresInDays} days: ${invitationUrl}`,
      htmlBody: `<p><strong>${escapeEmailHtml(created.invitedBy.name)}</strong> invited you to <strong>${escapeEmailHtml(created.tenant.name)}</strong>.</p><p>Accept this invitation within ${input.expiresInDays} days:</p><p><a href="${invitationUrl}">Accept invitation</a></p>`,
      idempotencyKey: `tenant-invitation:${created.id}`,
      correlationType: "TENANT_INVITATION",
      correlationId: created.id,
      expiresAt,
    });
    await appendTenantAccessEvent(transaction, {
      tenantId: input.tenantId,
      eventType: "INVITATION_CREATED",
      actorUserId: input.actorUserId,
      targetEmail: created.email,
      invitationId: created.id,
      summary: "Invitation created",
      metadata: {
        expiresAt: expiresAt.toISOString(),
        businessGrants: grantSnapshot(input.businessGrants),
      },
    });
    return created;
  });

  return { invitation, token };
}

export async function acceptTenantInvitation(input: { userId: string; userEmail: string; token: string }) {
  const tokenDigest = digestToken(input.token);
  const normalizedEmail = input.userEmail.trim().toLowerCase();
  const outcome = await db.$transaction(async (transaction) => {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "TenantInvitation"
      WHERE "tokenDigest" = ${tokenDigest}
      FOR UPDATE
    `;
    if (!locked[0]) throw new Error("INVITATION_INVALID");
    const invitation = await transaction.tenantInvitation.findUnique({
      where: { id: locked[0].id },
      include: { tenant: true, businessGrants: true },
    });
    if (!invitation || invitation.status !== InvitationStatus.PENDING) throw new Error("INVITATION_INVALID");
    if (invitation.expiresAt.getTime() <= Date.now()) {
      await transaction.tenantInvitation.update({ where: { id: invitation.id }, data: { status: InvitationStatus.EXPIRED } });
      await transaction.emailOutbox.updateMany({
        where: { correlationType: "TENANT_INVITATION", correlationId: invitation.id, status: { in: [EmailOutboxStatus.PENDING, EmailOutboxStatus.RETRY] } },
        data: { status: EmailOutboxStatus.EXPIRED, textBody: null, htmlBody: null, lastError: "INVITATION_EXPIRED" },
      });
      await appendTenantAccessEvent(transaction, {
        tenantId: invitation.tenantId,
        eventType: "INVITATION_EXPIRED",
        actorUserId: input.userId,
        targetUserId: input.userId,
        targetEmail: normalizedEmail,
        invitationId: invitation.id,
        summary: "Invitation expired during acceptance",
        metadata: { source: "ACCEPTANCE_ATTEMPT" },
      });
      return { kind: "expired" as const };
    }
    if (invitation.email !== normalizedEmail) throw new Error("INVITATION_EMAIL_MISMATCH");
    if (invitation.tenant.status !== TenantStatus.ACTIVE) throw new Error("TENANT_NOT_ACTIVE");

    const existingTenantMembership = await transaction.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: invitation.tenantId, userId: input.userId } },
      select: { status: true },
    });
    await transaction.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: invitation.tenantId, userId: input.userId } },
      update: { status: MembershipStatus.ACTIVE },
      create: { tenantId: invitation.tenantId, userId: input.userId, status: MembershipStatus.ACTIVE },
    });
    if (existingTenantMembership?.status !== MembershipStatus.ACTIVE) {
      await appendTenantAccessEvent(transaction, {
        tenantId: invitation.tenantId,
        eventType: "MEMBER_ACTIVATED",
        actorUserId: input.userId,
        targetUserId: input.userId,
        targetEmail: normalizedEmail,
        invitationId: invitation.id,
        summary: "Tenant member activated",
        metadata: { source: "INVITATION", previousStatus: existingTenantMembership?.status ?? null },
      });
    }

    for (const grant of invitation.businessGrants) {
      const role = getBusinessRole(grant.roleKey);
      if (!role || role.key === "business.owner") throw new Error("INVALID_BUSINESS_ROLE");
      const existingGrant = await transaction.businessMembership.findUnique({
        where: { businessId_userId: { businessId: grant.businessId, userId: input.userId } },
        select: { roleKey: true, status: true },
      });
      await transaction.businessMembership.upsert({
        where: { businessId_userId: { businessId: grant.businessId, userId: input.userId } },
        update: { tenantId: invitation.tenantId, roleKey: grant.roleKey, status: MembershipStatus.ACTIVE },
        create: { tenantId: invitation.tenantId, businessId: grant.businessId, userId: input.userId, roleKey: grant.roleKey, status: MembershipStatus.ACTIVE },
      });
      if (!existingGrant) {
        await appendTenantAccessEvent(transaction, {
          tenantId: invitation.tenantId,
          eventType: "BUSINESS_ACCESS_GRANTED",
          actorUserId: input.userId,
          targetUserId: input.userId,
          targetEmail: normalizedEmail,
          businessId: grant.businessId,
          invitationId: invitation.id,
          summary: "Business access granted",
          metadata: { source: "INVITATION", roleKey: grant.roleKey, status: MembershipStatus.ACTIVE },
        });
      } else if (existingGrant.roleKey !== grant.roleKey || existingGrant.status !== MembershipStatus.ACTIVE) {
        await appendTenantAccessEvent(transaction, {
          tenantId: invitation.tenantId,
          eventType: "BUSINESS_ACCESS_UPDATED",
          actorUserId: input.userId,
          targetUserId: input.userId,
          targetEmail: normalizedEmail,
          businessId: grant.businessId,
          invitationId: invitation.id,
          summary: "Business access updated",
          metadata: {
            source: "INVITATION",
            previousRoleKey: existingGrant.roleKey,
            roleKey: grant.roleKey,
            previousStatus: existingGrant.status,
            status: MembershipStatus.ACTIVE,
          },
        });
      }
    }
    await transaction.emailOutbox.updateMany({
      where: { correlationType: "TENANT_INVITATION", correlationId: invitation.id, status: { in: [EmailOutboxStatus.PENDING, EmailOutboxStatus.RETRY] } },
      data: { status: EmailOutboxStatus.CANCELLED, textBody: null, htmlBody: null, lastError: "INVITATION_ALREADY_ACCEPTED" },
    });
    const accepted = await transaction.tenantInvitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.ACCEPTED, acceptedByUserId: input.userId, acceptedAt: new Date() },
      include: { businessGrants: true },
    });
    await appendTenantAccessEvent(transaction, {
      tenantId: invitation.tenantId,
      eventType: "INVITATION_ACCEPTED",
      actorUserId: input.userId,
      targetUserId: input.userId,
      targetEmail: normalizedEmail,
      invitationId: invitation.id,
      summary: "Invitation accepted",
      metadata: { businessGrants: grantSnapshot(invitation.businessGrants) },
    });
    return { kind: "accepted" as const, invitation: accepted };
  });
  if (outcome.kind === "expired") throw new Error("INVITATION_EXPIRED");
  return outcome.invitation;
}

export async function listTenantAccessAdministration(input: { actorUserId: string; tenantId: string }) {
  await requireTenantAccessAdministration(input.actorUserId, input.tenantId);
  await expirePendingInvitations(input.tenantId);
  const administration = await db.tenant.findUniqueOrThrow({
    where: { id: input.tenantId },
    select: {
      id: true,
      name: true,
      businesses: { orderBy: { legalName: "asc" }, select: { id: true, legalName: true } },
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true, isOwner: true, status: true,
          user: { select: { id: true, name: true, email: true } },
          businesses: { select: { status: true, roleKey: true, business: { select: { id: true, legalName: true } } } },
        },
      },
      invitations: {
        where: { status: InvitationStatus.PENDING, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, email: true, expiresAt: true, createdAt: true,
          businessGrants: { select: { roleKey: true, business: { select: { id: true, legalName: true } } } },
        },
      },
    },
  });
  const accessEvents = await db.tenantAccessEvent.findMany({
    where: { tenantId: input.tenantId },
    include: {
      actor: { select: { id: true, name: true, email: true } },
      targetUser: { select: { id: true, name: true, email: true } },
      business: { select: { id: true, legalName: true, tradingName: true } },
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  const deliveryRows = await db.emailOutbox.findMany({
    where: { tenantId: input.tenantId, correlationType: "TENANT_INVITATION", correlationId: { in: administration.invitations.map((invitation) => invitation.id) } },
    select: { correlationId: true, status: true, attempts: true, lastError: true, sentAt: true, availableAt: true },
  });
  const deliveryByInvitation = new Map(deliveryRows.map((row) => [row.correlationId, row]));
  return {
    ...administration,
    invitations: administration.invitations.map((invitation) => ({ ...invitation, delivery: deliveryByInvitation.get(invitation.id) ?? null })),
    accessEvents,
  };
}
