import { MembershipStatus, TenantStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";

export async function requireTenantOwner(actorUserId: string, tenantId: string) {
  const owner = await db.tenantMembership.findFirst({
    where: {
      tenantId,
      userId: actorUserId,
      status: MembershipStatus.ACTIVE,
      isOwner: true,
      tenant: { status: TenantStatus.ACTIVE },
    },
    select: { id: true },
  });
  if (!owner) throw new Error("TENANT_OWNER_REQUIRED");
}

export async function requireTenantAccessAdministration(actorUserId: string, tenantId: string) {
  await requireTenantOwner(actorUserId, tenantId);
  await requireTenantFeature(tenantId, "users.manage");
}
