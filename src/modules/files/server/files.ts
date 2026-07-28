import type { BusinessAccessContext } from "@/modules/tenancy/server/context";
import { db } from "@/lib/db";
import { requireBusinessCapability } from "@/modules/access/server/authorize";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";
import { appendAuditEvent } from "@/modules/audit/server/audit";
import { createStorageKey, validatePrivateFile } from "@/modules/files/storage/validation";
import { privateFileMaxBytes, privateStorage } from "@/modules/files/storage";

async function requireFiles(context: BusinessAccessContext, capability: "files.view" | "files.manage") {
  requireBusinessCapability(context, capability);
  await requireTenantFeature(context.tenantId, "files.core");
}

export async function listStoredFiles(context: BusinessAccessContext) {
  await requireFiles(context, "files.view");
  return db.storedFile.findMany({
    where: { tenantId: context.tenantId, businessId: context.businessId, status: { not: "DELETED" } },
    include: { attachments: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function uploadPrivateFile(context: BusinessAccessContext, input: {
  name: string;
  contentType: string;
  bytes: Uint8Array;
  entityType?: string;
  entityId?: string;
  label?: string;
}) {
  await requireFiles(context, "files.manage");
  const validated = validatePrivateFile({ name: input.name, contentType: input.contentType, bytes: input.bytes, maxBytes: privateFileMaxBytes() });
  const storage = privateStorage();
  const storageKey = createStorageKey({ tenantId: context.tenantId, businessId: context.businessId, extension: validated.extension });
  await storage.write(storageKey, input.bytes);
  try {
    return await db.$transaction(async (transaction) => {
      const file = await transaction.storedFile.create({
        data: {
          tenantId: context.tenantId,
          businessId: context.businessId,
          storageProvider: storage.provider,
          storageKey,
          originalName: input.name.slice(0, 255),
          safeName: validated.safeName,
          extension: validated.extension,
          contentType: input.contentType,
          sizeBytes: input.bytes.byteLength,
          sha256: validated.sha256,
          uploadedById: context.userId,
        },
      });
      await transaction.fileAttachment.create({
        data: {
          tenantId: context.tenantId,
          businessId: context.businessId,
          fileId: file.id,
          entityType: (input.entityType || "BUSINESS").trim().slice(0, 80),
          entityId: (input.entityId || context.businessId).trim().slice(0, 191),
          label: input.label?.trim().slice(0, 160) || null,
        },
      });
      await appendAuditEvent({ transaction, context, eventType: "FILE_UPLOADED", entityType: "STORED_FILE", entityId: file.id, summary: `Uploaded ${validated.safeName}`, metadata: { sha256: validated.sha256, sizeBytes: input.bytes.byteLength, contentType: input.contentType } });
      return file;
    });
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
}

export async function readPrivateFile(context: BusinessAccessContext, fileId: string) {
  await requireFiles(context, "files.view");
  const file = await db.storedFile.findFirst({ where: { id: fileId, tenantId: context.tenantId, businessId: context.businessId, status: "AVAILABLE" } });
  if (!file) throw new Error("FILE_NOT_FOUND");
  const storage = privateStorage();
  if (storage.provider !== file.storageProvider) throw new Error("FILE_STORAGE_PROVIDER_MISMATCH");
  const bytes = await storage.read(file.storageKey);
  await appendAuditEvent({ context, eventType: "FILE_DOWNLOADED", entityType: "STORED_FILE", entityId: file.id, summary: `Downloaded ${file.safeName}`, metadata: { sha256: file.sha256, sizeBytes: file.sizeBytes } });
  return { file, bytes };
}
