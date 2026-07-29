import { Prisma, type TenantAccessEventType } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireTenantAccessAdministration } from "@/modules/tenancy/server/access-admin";

const forbiddenMetadataKey = /(password|secret|token|url)/i;

function assertSafeMetadata(value: unknown, path = "metadata"): void {
  if (value === null || typeof value === "boolean" || typeof value === "number") return;
  if (typeof value === "string") {
    if (/https?:\/\//i.test(value)) throw new Error(`TENANT_ACCESS_AUDIT_UNSAFE:${path}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSafeMetadata(entry, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (forbiddenMetadataKey.test(key)) throw new Error(`TENANT_ACCESS_AUDIT_UNSAFE:${path}.${key}`);
      assertSafeMetadata(entry, `${path}.${key}`);
    }
    return;
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
  const metadata = input.metadata ?? {};
  assertSafeMetadata(metadata);
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
      metadata: metadata as Prisma.InputJsonValue,
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
