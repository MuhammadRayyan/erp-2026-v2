import { MembershipStatus, TenantStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type BusinessAccessContext = {
  userId: string;
  tenantId: string;
  businessId: string;
  roleKey: string;
  tenantName: string;
  businessName: string;
};

export async function resolveBusinessAccessContext(input: {
  userId: string;
  businessId: string;
}): Promise<BusinessAccessContext | null> {
  const membership = await db.businessMembership.findFirst({
    where: {
      userId: input.userId,
      businessId: input.businessId,
      status: MembershipStatus.ACTIVE,
      tenantUser: {
        status: MembershipStatus.ACTIVE,
      },
      business: {
        tenant: {
          status: TenantStatus.ACTIVE,
        },
      },
    },
    select: {
      tenantId: true,
      businessId: true,
      roleKey: true,
      business: {
        select: {
          legalName: true,
          tenant: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!membership) {
    return null;
  }

  return {
    userId: input.userId,
    tenantId: membership.tenantId,
    businessId: membership.businessId,
    roleKey: membership.roleKey,
    tenantName: membership.business.tenant.name,
    businessName: membership.business.legalName,
  };
}

export async function requireBusinessAccessContext(input: {
  userId: string;
  businessId: string;
}): Promise<BusinessAccessContext> {
  const context = await resolveBusinessAccessContext(input);

  if (!context) {
    throw new Error("BUSINESS_ACCESS_DENIED");
  }

  return context;
}
