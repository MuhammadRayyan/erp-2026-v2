import { InvitationStatus, MembershipStatus, SubscriptionStatus, type Prisma } from "@/generated/prisma/client";

export async function requireTenantUserInvitationCapacityInTransaction(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  email: string,
) {
  await transaction.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId} FOR UPDATE`;

  const subscription = await transaction.tenantSubscription.findUnique({
    where: { tenantId },
    include: {
      plan: {
        include: {
          entitlements: {
            where: { feature: { key: { in: ["users.manage", "limit.users"] } } },
            include: { feature: true },
          },
        },
      },
      tenant: {
        include: {
          entitlementOverrides: {
            where: { feature: { key: { in: ["users.manage", "limit.users"] } } },
            include: { feature: true },
          },
        },
      },
    },
  });

  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE || !subscription.plan.active) {
    throw new Error("TENANT_SUBSCRIPTION_INACTIVE");
  }

  const values = new Map<string, { enabled?: boolean | null; limitValue?: number | null; unlimited: boolean }>();
  for (const entitlement of subscription.plan.entitlements) {
    values.set(entitlement.feature.key, entitlement);
  }
  for (const override of subscription.tenant.entitlementOverrides) {
    values.set(override.feature.key, override);
  }

  if (!values.get("users.manage")?.enabled) {
    throw new Error("TENANT_FEATURE_DISABLED");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const [activeMembers, otherPendingInvitations] = await Promise.all([
    transaction.tenantMembership.count({
      where: { tenantId, status: MembershipStatus.ACTIVE },
    }),
    transaction.tenantInvitation.count({
      where: {
        tenantId,
        status: InvitationStatus.PENDING,
        email: { not: normalizedEmail },
      },
    }),
  ]);

  const configuredLimit = values.get("limit.users");
  if (!configuredLimit) throw new Error("TENANT_LIMIT_NOT_CONFIGURED");
  const limit = configuredLimit.unlimited ? null : configuredLimit.limitValue ?? 0;
  if (limit !== null && activeMembers + otherPendingInvitations + 1 > limit) {
    throw new Error("TENANT_LIMIT_REACHED");
  }

  return { limit, currentUsage: activeMembers + otherPendingInvitations };
}
