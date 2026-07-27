import { createHash, randomBytes } from "node:crypto";
import { InvitationStatus, MembershipStatus, TenantStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getBusinessRole } from "@/modules/access/roles";

function digestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function requireTenantOwner(userId: string, tenantId: string) {
  const membership = await db.tenantMembership.findFirst({
    where: {
      userId,
      tenantId,
      status: MembershipStatus.ACTIVE,
      isOwner: true,
      tenant: { status: TenantStatus.ACTIVE },
    },
    select: { id: true },
  });

  if (!membership) {
    throw new Error("TENANT_OWNER_REQUIRED");
  }
}

export async function createTenantInvitation(input: {
  actorUserId: string;
  tenantId: string;
  email: string;
  expiresInDays: number;
  businessGrants: Array<{ businessId: string; roleKey: string }>;
}) {
  await requireTenantOwner(input.actorUserId, input.tenantId);

  for (const grant of input.businessGrants) {
    if (!getBusinessRole(grant.roleKey)) {
      throw new Error("INVALID_BUSINESS_ROLE");
    }
  }

  const businesses = await db.business.findMany({
    where: {
      tenantId: input.tenantId,
      id: { in: input.businessGrants.map((grant) => grant.businessId) },
    },
    select: { id: true },
  });

  if (businesses.length !== input.businessGrants.length) {
    throw new Error("INVALID_BUSINESS_GRANT");
  }

  const token = randomBytes(32).toString("base64url");
  const tokenDigest = digestToken(token);
  const normalizedEmail = input.email.trim().toLowerCase();
  const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);

  const invitation = await db.$transaction(async (transaction) => {
    await transaction.tenantInvitation.updateMany({
      where: {
        tenantId: input.tenantId,
        email: normalizedEmail,
        status: InvitationStatus.PENDING,
      },
      data: { status: InvitationStatus.REVOKED },
    });

    return transaction.tenantInvitation.create({
      data: {
        tenantId: input.tenantId,
        email: normalizedEmail,
        tokenDigest,
        expiresAt,
        invitedByUserId: input.actorUserId,
        businessGrants: {
          create: input.businessGrants.map((grant) => ({
            tenantId: input.tenantId,
            businessId: grant.businessId,
            roleKey: grant.roleKey,
          })),
        },
      },
      include: {
        tenant: { select: { name: true } },
        invitedBy: { select: { name: true, email: true } },
        businessGrants: {
          include: { business: { select: { legalName: true } } },
        },
      },
    });
  });

  return { invitation, token };
}

export async function acceptTenantInvitation(input: {
  userId: string;
  userEmail: string;
  token: string;
}) {
  const tokenDigest = digestToken(input.token);
  const normalizedEmail = input.userEmail.trim().toLowerCase();

  return db.$transaction(async (transaction) => {
    const invitation = await transaction.tenantInvitation.findUnique({
      where: { tokenDigest },
      include: {
        tenant: true,
        businessGrants: true,
      },
    });

    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      throw new Error("INVITATION_INVALID");
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      await transaction.tenantInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new Error("INVITATION_EXPIRED");
    }

    if (invitation.email !== normalizedEmail) {
      throw new Error("INVITATION_EMAIL_MISMATCH");
    }

    if (invitation.tenant.status !== TenantStatus.ACTIVE) {
      throw new Error("TENANT_NOT_ACTIVE");
    }

    await transaction.tenantMembership.upsert({
      where: {
        tenantId_userId: {
          tenantId: invitation.tenantId,
          userId: input.userId,
        },
      },
      update: { status: MembershipStatus.ACTIVE },
      create: {
        tenantId: invitation.tenantId,
        userId: input.userId,
        status: MembershipStatus.ACTIVE,
      },
    });

    for (const grant of invitation.businessGrants) {
      await transaction.businessMembership.upsert({
        where: {
          businessId_userId: {
            businessId: grant.businessId,
            userId: input.userId,
          },
        },
        update: {
          tenantId: invitation.tenantId,
          roleKey: grant.roleKey,
          status: MembershipStatus.ACTIVE,
        },
        create: {
          tenantId: invitation.tenantId,
          businessId: grant.businessId,
          userId: input.userId,
          roleKey: grant.roleKey,
          status: MembershipStatus.ACTIVE,
        },
      });
    }

    return transaction.tenantInvitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.ACCEPTED,
        acceptedByUserId: input.userId,
        acceptedAt: new Date(),
      },
      include: { businessGrants: true },
    });
  });
}

export async function listTenantAccessAdministration(input: {
  actorUserId: string;
  tenantId: string;
}) {
  await requireTenantOwner(input.actorUserId, input.tenantId);

  return db.tenant.findUniqueOrThrow({
    where: { id: input.tenantId },
    select: {
      id: true,
      name: true,
      businesses: {
        orderBy: { legalName: "asc" },
        select: { id: true, legalName: true },
      },
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          isOwner: true,
          status: true,
          user: { select: { id: true, name: true, email: true } },
          businesses: {
            select: {
              status: true,
              roleKey: true,
              business: { select: { id: true, legalName: true } },
            },
          },
        },
      },
      invitations: {
        where: { status: InvitationStatus.PENDING },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          expiresAt: true,
          createdAt: true,
          businessGrants: {
            select: {
              roleKey: true,
              business: { select: { id: true, legalName: true } },
            },
          },
        },
      },
    },
  });
}
