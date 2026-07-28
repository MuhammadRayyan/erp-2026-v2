import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { listAuditEvents } from "../../src/modules/audit/server/audit";
import { listStoredFiles, readPrivateFile, uploadPrivateFile } from "../../src/modules/files/server/files";
import { onboardOwner } from "../../src/modules/tenancy/server/onboarding";

const roots: string[] = [];
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0x45, 0x4f, 0x46]);

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function ownerContext(label: string) {
  const user = await db.user.create({ data: { id: randomUUID(), name: "Files Owner", email: `${label}-${randomUUID()}@example.com`, emailVerified: true } });
  const operation = await onboardOwner({ idempotencyKey: `${label}-${randomUUID()}`, userId: user.id, tenantName: `${label} Tenant`, businessLegalName: `${label} Business LLC` });
  return { userId: user.id, tenantId: operation.tenantId, businessId: operation.businessId, roleKey: "business.owner", tenantName: `${label} Tenant`, businessName: `${label} Business LLC`, planKey: "internal-unlimited", planName: "Internal Unlimited", enabledFeatures: ["files.core"] };
}

async function storageRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "erp-files-"));
  roots.push(root);
  process.env.FILE_STORAGE_PROVIDER = "local";
  process.env.FILE_STORAGE_ROOT = root;
  process.env.FILE_MAX_BYTES = "1048576";
  return root;
}

describe("private files and audit history", () => {
  it("stores, lists, reads, hashes, attaches, and audits a private file", async () => {
    await storageRoot();
    const context = await ownerContext("files-create");
    const file = await uploadPrivateFile(context, { name: "Trade License.pdf", contentType: "application/pdf", bytes: pdf, label: "Trade license" });
    expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
    const listed = await listStoredFiles(context);
    expect(listed[0]?.attachments[0]).toMatchObject({ entityType: "BUSINESS", entityId: context.businessId, label: "Trade license" });
    const downloaded = await readPrivateFile(context, file.id);
    expect(Array.from(downloaded.bytes)).toEqual(Array.from(pdf));
    const events = await listAuditEvents(context);
    expect(events.map((event) => event.eventType)).toEqual(expect.arrayContaining(["FILE_UPLOADED", "FILE_DOWNLOADED"]));
  });

  it("enforces management capability and tenant boundaries", async () => {
    await storageRoot();
    const first = await ownerContext("files-first");
    const second = await ownerContext("files-second");
    await expect(uploadPrivateFile({ ...first, roleKey: "business.viewer" }, { name: "viewer.pdf", contentType: "application/pdf", bytes: pdf })).rejects.toThrow("BUSINESS_CAPABILITY_DENIED");
    const file = await uploadPrivateFile(first, { name: "private.pdf", contentType: "application/pdf", bytes: pdf });
    await expect(readPrivateFile(second, file.id)).rejects.toThrow("FILE_NOT_FOUND");
    await expect(db.fileAttachment.create({ data: { tenantId: second.tenantId, businessId: second.businessId, fileId: file.id, entityType: "BUSINESS", entityId: second.businessId } })).rejects.toThrow();
  });

  it("enforces the tenant entitlement and audit capability", async () => {
    await storageRoot();
    const context = await ownerContext("files-access");
    const feature = await db.featureDefinition.findUniqueOrThrow({ where: { key: "files.core" } });
    await db.tenantEntitlementOverride.create({ data: { tenantId: context.tenantId, featureId: feature.id, enabled: false, reason: "Integration test" } });
    await expect(listStoredFiles(context)).rejects.toThrow("TENANT_FEATURE_DISABLED");
    await expect(listAuditEvents({ ...context, roleKey: "business.technician" })).rejects.toThrow("BUSINESS_CAPABILITY_DENIED");
  });
});
