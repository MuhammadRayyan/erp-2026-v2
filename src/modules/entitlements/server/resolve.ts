import { SubscriptionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { BooleanFeatureKey, LimitFeatureKey } from "@/modules/entitlements/catalog";

export type TenantEntitlements = {
  plan: { key: string; name: string; isInternal: boolean };
  enabledFeatures: Set<string>;
  limits: Map<string, number | null>;
};

export async function resolveTenantEntitlements(tenantId: string): Promise<TenantEntitlements> {
  const subscription = await db.tenantSubscription.findUnique({
    where: { tenantId },
    include: {
      plan: {
        include: {
          entitlements: { include: { feature: true } },
        },
      },
      tenant: {
        include: {
          entitlementOverrides: { include: { feature: true } },
        },
      },
    },
  });

  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE || !subscription.plan.active) {
    throw new Error("TENANT_SUBSCRIPTION_INACTIVE");
  }

  const enabledFeatures = new Set<string>();
  const limits = new Map<string, number | null>();

  for (const entitlement of subscription.plan.entitlements) {
    if (entitlement.feature.valueType === "BOOLEAN" && entitlement.enabled) {
      enabledFeatures.add(entitlement.feature.key);
    }
    if (entitlement.feature.valueType === "LIMIT") {
      limits.set(entitlement.feature.key, entitlement.unlimited ? null : entitlement.limitValue ?? 0);
    }
  }

  for (const override of subscription.tenant.entitlementOverrides) {
    if (override.feature.valueType === "BOOLEAN") {
      if (override.enabled) enabledFeatures.add(override.feature.key);
      else enabledFeatures.delete(override.feature.key);
    } else {
      limits.set(override.feature.key, override.unlimited ? null : override.limitValue ?? 0);
    }
  }

  return {
    plan: {
      key: subscription.plan.key,
      name: subscription.plan.name,
      isInternal: subscription.plan.isInternal,
    },
    enabledFeatures,
    limits,
  };
}

export async function requireTenantFeature(tenantId: string, featureKey: BooleanFeatureKey) {
  const entitlements = await resolveTenantEntitlements(tenantId);
  if (!entitlements.enabledFeatures.has(featureKey)) {
    throw new Error("TENANT_FEATURE_DISABLED");
  }
  return entitlements;
}

export async function requireTenantCapacity(input: {
  tenantId: string;
  limitKey: LimitFeatureKey;
  currentUsage: number;
  increment?: number;
}) {
  const entitlements = await resolveTenantEntitlements(input.tenantId);
  const limit = entitlements.limits.get(input.limitKey);
  if (limit === undefined) throw new Error("TENANT_LIMIT_NOT_CONFIGURED");
  if (limit !== null && input.currentUsage + (input.increment ?? 1) > limit) {
    throw new Error("TENANT_LIMIT_REACHED");
  }
  return { ...entitlements, limit };
}
