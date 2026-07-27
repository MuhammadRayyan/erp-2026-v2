import { headers } from "next/headers";
import type { BusinessCapability } from "@/modules/access/roles";
import { requireBusinessCapability } from "@/modules/access/server/authorize";
import { requireRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";

export async function requireBusinessPageCapability(
  businessId: string,
  capability: BusinessCapability,
) {
  const session = await requireRequestSession(await headers());
  const context = await requireBusinessAccessContext({
    userId: session.user.id,
    businessId,
  });

  return {
    session,
    context: requireBusinessCapability(context, capability),
  };
}
