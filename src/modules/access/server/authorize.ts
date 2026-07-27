import type { BusinessCapability } from "@/modules/access/roles";
import { hasBusinessCapability } from "@/modules/access/roles";
import type { BusinessAccessContext } from "@/modules/tenancy/server/context";

export function requireBusinessCapability(
  context: BusinessAccessContext,
  capability: BusinessCapability,
) {
  if (!hasBusinessCapability(context.roleKey, capability)) {
    throw new Error("BUSINESS_CAPABILITY_DENIED");
  }

  return context;
}
