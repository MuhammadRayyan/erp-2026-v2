import { Prisma, type TenantAccessEventType } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireTenantAccessAdministration } from "@/modules/tenancy/server/access-admin";

const forbiddenMetadataKey = /(password|secret|token|url)/i;

function safeJsonValue(value: unknown, path: string): Prisma.InputJsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    if (/https?:\/\//i.test(value)) throw new Error(`TENANT_ACCESS_AUDIT_UNSAFE:${path}`);
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.filter((entry) => entry !== undefined).map((entry, index) => safeJsonValue(entry, `${path}[${index}]`));
  }
  if (typeof value === "object") {
    const result: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (forbiddenMetadataKey.test(key)) throw new Error(`TENANT_ACCESS_AUDIT_UNSAFE:${path}.${key}`);
      if (entry === undefined) continue;
      result[key] = safeJsonValue(entry, `${path}.${key}`);
    }
    return result;
  }
  throw new Error(`TENANT_ACCESS_AUDIT_UNSAFE:${path}`);
}

export type TenantAccessAuditInput = {
  tenantId: string;
  eventType: TenantAccessEventType;
  actorUserId?: string | null;
  targetUserId?: string | null;
  targetEmail: string;
  businessId?: string | null;
  invitationId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
};

export async function appendTenantAccessEvent(
  transaction: Prisma.TransactionClient,
  input: TenantAccessAuditInput,
) {
  const metadata = safeJsonValue(input.metadata ?? {}, "metadata");
  const targetEmail = input.targetEmail.trim().toLowerCase();
  if (!targetEmail) throw new Error("TENANT_ACCESS_AUDIT_TARGET_REQUIRED");

  return transaction.tenantAccessEvent.create({
    data: {
      tenantId: input.tenantId,
      eventType: input.eventType,
      actorUserId: input.actorUserId ?? null,
      targetUserId: input.targetUserId ?? null,
      targetEmail,
      businessId: input.businessId ?? null,
      invitationId: input.invitationId ?? null,
      summary: input.summary.trim(),
      metadata,
    },
  });
}

export async function listTenantAccessEvents(input: {
  actorUserId: string;
  tenantId: string;
  limit?: number;
}) {
  await requireTenantAccessAdministration(input.actorUserId, input.tenantId);
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 200);
  return db.tenantAccessEvent.findMany({
    where: { tenantId: input.tenantId },
    include: {
      actor: { select: { id: true, name: true, email: true } },
      targetUser: { select: { id: true, name: true, email: true } },
      business: { select: { id: true, legalName: true, tradingName: true } },
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: limit,
  });
}
