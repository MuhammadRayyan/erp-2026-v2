import { InvitationStatus, MembershipStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireTenantCapacity, requireTenantFeature } from "@/modules/entitlements/server/resolve";

export async function requireTenantUserInvitationCapacity(tenantId: string, email: string) {
  await requireTenantFeature(tenantId, "users.manage");
  const normalizedEmail = email.trim().toLowerCase();

  const [activeMembers, otherPendingInvitations] = await Promise.all([
    db.tenantMembership.count({
      where: { tenantId, status: MembershipStatus.ACTIVE },
    }),
    db.tenantInvitation.count({
      where: {
        tenantId,
        status: InvitationStatus.PENDING,
        email: { not: normalizedEmail },
      },
    }),
  ]);

  return requireTenantCapacity({
    tenantId,
    limitKey: "limit.users",
    currentUsage: activeMembers + otherPendingInvitations,
  });
}
