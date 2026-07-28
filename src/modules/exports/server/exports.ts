import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireBusinessCapability } from "@/modules/access/server/authorize";
import { appendAuditEvent } from "@/modules/audit/server/audit";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";
import { serializeCsv } from "@/modules/exports/csv";
import { EXPORT_ROW_LIMIT, getExportDataset } from "@/modules/exports/datasets";
import type { BusinessAccessContext } from "@/modules/tenancy/server/context";

function cleanFilters(filters: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(filters).filter((entry): entry is [string, string] => entry[1] !== undefined));
}

function exportFileName(datasetKey: string) {
  return `${datasetKey}-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
}

export async function generateExport(context: BusinessAccessContext, datasetKey: string, rawFilters: unknown) {
  requireBusinessCapability(context, "exports.run");
  await requireTenantFeature(context.tenantId, "exports.core");
  const [key, dataset] = getExportDataset(datasetKey);
  requireBusinessCapability(context, dataset.capability);
  const filters = dataset.parseFilters(rawFilters);
  const rows = await dataset.load(context, filters);
  if (rows.length > EXPORT_ROW_LIMIT) throw new Error("EXPORT_ROW_LIMIT_EXCEEDED");

  const csv = serializeCsv(dataset.headers, rows);
  const bytes = Buffer.from(csv, "utf8");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const fileName = exportFileName(key);
  const persistedFilters = cleanFilters(filters) as Prisma.InputJsonValue;

  const run = await db.$transaction(async (transaction) => {
    const created = await transaction.exportRun.create({
      data: {
        tenantId: context.tenantId,
        businessId: context.businessId,
        datasetKey: key,
        filters: persistedFilters,
        rowCount: rows.length,
        sha256,
        fileName,
        requestedById: context.userId,
      },
    });
    await appendAuditEvent({
      transaction,
      context,
      eventType: "EXPORT_GENERATED",
      entityType: "EXPORT_RUN",
      entityId: created.id,
      summary: `Generated ${dataset.label} CSV export`,
      metadata: { datasetKey: key, rowCount: rows.length, sha256, filters: persistedFilters },
    });
    return created;
  });

  return { run, bytes };
}

export async function listExportRuns(context: BusinessAccessContext, limit = 100) {
  requireBusinessCapability(context, "exports.run");
  await requireTenantFeature(context.tenantId, "exports.core");
  return db.exportRun.findMany({
    where: { tenantId: context.tenantId, businessId: context.businessId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
  });
}
