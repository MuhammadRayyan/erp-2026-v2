import { Prisma } from "@/generated/prisma/client";
import type { BusinessAccessContext } from "@/modules/tenancy/server/context";
import { db } from "@/lib/db";
import { requireBusinessCapability } from "@/modules/access/server/authorize";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";

export async function appendAuditEvent(input: {
  transaction?: Prisma.TransactionClient;
  context: BusinessAccessContext;
  eventType: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const client = input.transaction ?? db;
  return client.auditEvent.create({
    data: {
      tenantId: input.context.tenantId,
      businessId: input.context.businessId,
      actorUserId: input.context.userId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      metadata: input.metadata ?? {},
    },
  });
}

export async function listAuditEvents(context: BusinessAccessContext, limit = 100) {
  requireBusinessCapability(context, "audit.view");
  await requireTenantFeature(context.tenantId, "files.core");
  return db.auditEvent.findMany({
    where: { tenantId: context.tenantId, businessId: context.businessId },
    orderBy: { occurredAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
  });
}
