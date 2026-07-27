import { headers } from "next/headers";
import type { BusinessCapability } from "@/modules/access/roles";
import { requireBusinessCapability } from "@/modules/access/server/authorize";
import type { BooleanFeatureKey } from "@/modules/entitlements/catalog";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";
import { requireRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";

export async function requireBusinessPageAccess(
  businessId: string,
  capability: BusinessCapability,
  featureKey: BooleanFeatureKey,
) {
  const session = await requireRequestSession(await headers());
  const context = await requireBusinessAccessContext({
    userId: session.user.id,
    businessId,
  });

  requireBusinessCapability(context, capability);
  await requireTenantFeature(context.tenantId, featureKey);

  return { session, context };
}

export const requireBusinessPageCapability = requireBusinessPageAccess;
