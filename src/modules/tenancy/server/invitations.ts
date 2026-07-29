import { createHash, randomBytes } from "node:crypto";
import { EmailOutboxCategory, EmailOutboxStatus, InvitationStatus, MembershipStatus, TenantStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/server-env";
import { getBusinessRole } from "@/modules/access/roles";
import { enqueueEmail } from "@/modules/communication/server/email-outbox";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";
import { escapeEmailHtml } from "@/modules/communication/server/platform-email";
import { requireTenantUserInvitationCapacityInTransaction } from "@/modules/entitlements/server/usage";

function digestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function requireTenantOwner(userId: string, tenantId: string) {
  const membership = await db.tenantMembership.findFirst({
    where: { userId, tenantId, status: MembershipStatus.ACTIVE, isOwner: true, tenant: { status: TenantStatus.ACTIVE } },
    select: { id: true },
  });
  if (!membership) throw new Error("TENANT_OWNER_REQUIRED");
}

async function requireTenantAccessAdministration(userId: string, tenantId: string) {
  await requireTenantOwner(userId, tenantId);
  await requireTenantFeature(tenantId, "users.manage");
}

async function expirePendingInvitations(tenantId: string, now = new Date()) {
  return db.$transaction(async (transaction) => {
    const expired = await transaction.tenantInvitation.findMany({
      where: { tenantId, status: InvitationStatus.PENDING, expiresAt: { lte: now } },
      select: { id: true },
    });
    const ids = expired.map(({ id }) => id);
    if (ids.length === 0) return 0;
    await transaction.tenantInvitation.updateMany({
      where: { tenantId, id: { in: ids }, status: InvitationStatus.PENDING },
      data: { status: InvitationStatus.EXPIRED },
    });
    await transaction.emailOutbox.updateMany({
      where: {
        tenantId,
        correlationType: "TENANT_INVITATION",
        correlationId: { in: ids },
        status: { in: [EmailOutboxStatus.PENDING, EmailOutboxStatus.RETRY] },
      },
      data: { status: EmailOutboxStatus.EXPIRED, textBody: null, htmlBody: null, lastError: "INVITATION_EXPIRED" },
    });
    return ids.length;
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
      select: { id: true },
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
    }

    const created = await transaction.tenantInvitation.create({
      data: {
        tenantId: input.tenantId,
        email: normalizedEmail,
        tokenDigest,
        expiresAt,
        invitedByUserId: input.actorUserId,
        businessGrants: { create: input.businessGrants.map((grant) => ({ tenantId: input.tenantId, businessId: grant.businessId, roleKey: grant.roleKey })) },
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
    return created;
  });

  return { invitation, token };
}

export async function acceptTenantInvitation(input: { userId: string; userEmail: string; token: string }) {
  const tokenDigest = digestToken(input.token);
  const normalizedEmail = input.userEmail.trim().toLowerCase();
  const outcome = await db.$transaction(async (transaction) => {
    const invitation = await transaction.tenantInvitation.findUnique({ where: { tokenDigest }, include: { tenant: true, businessGrants: true } });
    if (!invitation || invitation.status !== InvitationStatus.PENDING) throw new Error("INVITATION_INVALID");
    if (invitation.expiresAt.getTime() <= Date.now()) {
      await transaction.tenantInvitation.update({ where: { id: invitation.id }, data: { status: InvitationStatus.EXPIRED } });
      await transaction.emailOutbox.updateMany({
        where: { correlationType: "TENANT_INVITATION", correlationId: invitation.id, status: { in: [EmailOutboxStatus.PENDING, EmailOutboxStatus.RETRY] } },
        data: { status: EmailOutboxStatus.EXPIRED, textBody: null, htmlBody: null, lastError: "INVITATION_EXPIRED" },
      });
      return { kind: "expired" as const };
    }
    if (invitation.email !== normalizedEmail) throw new Error("INVITATION_EMAIL_MISMATCH");
    if (invitation.tenant.status !== TenantStatus.ACTIVE) throw new Error("TENANT_NOT_ACTIVE");

    await transaction.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: invitation.tenantId, userId: input.userId } },
      update: { status: MembershipStatus.ACTIVE },
      create: { tenantId: invitation.tenantId, userId: input.userId, status: MembershipStatus.ACTIVE },
    });
    for (const grant of invitation.businessGrants) {
      const role = getBusinessRole(grant.roleKey);
      if (!role || role.key === "business.owner") throw new Error("INVALID_BUSINESS_ROLE");
      await transaction.businessMembership.upsert({
        where: { businessId_userId: { businessId: grant.businessId, userId: input.userId } },
        update: { tenantId: invitation.tenantId, roleKey: grant.roleKey, status: MembershipStatus.ACTIVE },
        create: { tenantId: invitation.tenantId, businessId: grant.businessId, userId: input.userId, roleKey: grant.roleKey, status: MembershipStatus.ACTIVE },
      });
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
  const deliveryRows = await db.emailOutbox.findMany({
    where: { tenantId: input.tenantId, correlationType: "TENANT_INVITATION", correlationId: { in: administration.invitations.map((invitation) => invitation.id) } },
    select: { correlationId: true, status: true, attempts: true, lastError: true, sentAt: true, availableAt: true },
  });
  const deliveryByInvitation = new Map(deliveryRows.map((row) => [row.correlationId, row]));
  return { ...administration, invitations: administration.invitations.map((invitation) => ({ ...invitation, delivery: deliveryByInvitation.get(invitation.id) ?? null })) };
}
