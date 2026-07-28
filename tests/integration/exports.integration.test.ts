import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { createCatalogItem } from "../../src/modules/catalog/server/catalog";
import { generateExport, listExportRuns } from "../../src/modules/exports/server/exports";
import { createParty } from "../../src/modules/parties/server/parties";
import { onboardOwner } from "../../src/modules/tenancy/server/onboarding";

async function ownerContext(label: string) {
  const user = await db.user.create({ data: { id: randomUUID(), name: "Export Owner", email: `${label}-${randomUUID()}@example.com`, emailVerified: true } });
  const operation = await onboardOwner({ idempotencyKey: `${label}-${randomUUID()}`, userId: user.id, tenantName: `${label} Tenant`, businessLegalName: `${label} Business LLC` });
  return { userId: user.id, tenantId: operation.tenantId, businessId: operation.businessId, roleKey: "business.owner", tenantName: `${label} Tenant`, businessName: `${label} Business LLC`, planKey: "internal-unlimited", planName: "Internal Unlimited", enabledFeatures: ["exports.core", "parties.core", "catalog.core"] };
}

describe("reusable exports", () => {
  it("exports a filtered party register and persists checksum and audit metadata", async () => {
    const context = await ownerContext("export-parties");
    await createParty(context, { type: "ORGANIZATION", legalName: "=Formula Customer", firstName: null, lastName: null, email: "customer@example.com", phone: null, taxRegistrationNumber: null, notes: null, roles: ["CUSTOMER"] });
    await createParty(context, { type: "ORGANIZATION", legalName: "Supplier Only", firstName: null, lastName: null, email: "supplier@example.com", phone: null, taxRegistrationNumber: null, notes: null, roles: ["SUPPLIER"] });

    const result = await generateExport(context, "parties", { role: "CUSTOMER" });
    const csv = result.bytes.toString("utf8");
    expect(csv).toContain("'=Formula Customer");
    expect(csv).not.toContain("Supplier Only");
    expect(result.run).toMatchObject({ datasetKey: "parties", rowCount: 1, filters: { role: "CUSTOMER" } });
    expect(result.run.sha256).toBe(createHash("sha256").update(result.bytes).digest("hex"));

    const runs = await listExportRuns(context);
    expect(runs[0]?.id).toBe(result.run.id);
    const event = await db.auditEvent.findFirst({ where: { tenantId: context.tenantId, businessId: context.businessId, entityId: result.run.id, eventType: "EXPORT_GENERATED" } });
    expect(event).not.toBeNull();
  });

  it("exports filtered catalog rows with exact decimal text", async () => {
    const context = await ownerContext("export-catalog");
    const unit = await db.unitOfMeasure.findFirstOrThrow({ where: { tenantId: context.tenantId, businessId: context.businessId, code: "HOUR" } });
    await createCatalogItem(context, { type: "SERVICE", sku: "CONSULT", name: "Consulting", description: null, unitId: unit.id, salesEnabled: true, purchaseEnabled: false, defaultSalesPrice: "125.5000", defaultPurchasePrice: null, salesAccountClassKey: "SERVICE_REVENUE", purchaseAccountClassKey: "SERVICE_COST", defaultSalesTaxCategory: "STANDARD_RATE", defaultPurchaseTaxCategory: "UNSPECIFIED" });
    await createCatalogItem(context, { type: "PRODUCT", sku: "PART", name: "Spare Part", description: null, unitId: unit.id, salesEnabled: true, purchaseEnabled: true, defaultSalesPrice: "20.0000", defaultPurchasePrice: "10.0000", salesAccountClassKey: "PRODUCT_REVENUE", purchaseAccountClassKey: "INVENTORY_PURCHASE", defaultSalesTaxCategory: "STANDARD_RATE", defaultPurchaseTaxCategory: "STANDARD_RATE" });

    const result = await generateExport(context, "catalog", { type: "SERVICE", status: "ACTIVE" });
    const csv = result.bytes.toString("utf8");
    expect(csv).toContain("Consulting");
    expect(csv).toContain("125.5");
    expect(csv).not.toContain("Spare Part");
    expect(result.run.rowCount).toBe(1);
  });

  it("enforces export capability, entitlement, and composite tenant scope", async () => {
    const first = await ownerContext("export-first");
    const second = await ownerContext("export-second");
    await expect(generateExport({ ...first, roleKey: "business.viewer" }, "parties", {})).rejects.toThrow("BUSINESS_CAPABILITY_DENIED");

    const feature = await db.featureDefinition.findUniqueOrThrow({ where: { key: "exports.core" } });
    await db.tenantEntitlementOverride.create({ data: { tenantId: first.tenantId, featureId: feature.id, enabled: false, reason: "Integration test" } });
    await expect(generateExport(first, "parties", {})).rejects.toThrow("TENANT_FEATURE_DISABLED");

    await expect(db.exportRun.create({ data: { tenantId: first.tenantId, businessId: second.businessId, datasetKey: "parties", filters: {}, rowCount: 0, sha256: "a".repeat(64), fileName: "invalid.csv", requestedById: first.userId } })).rejects.toThrow();
  });
});
