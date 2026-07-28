import { randomUUID } from "node:crypto";
import { Prisma } from "../../src/generated/prisma/client";
import { describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { commitCatalogImport, getCatalogImport, previewCatalogImport, resolveCatalogImportRow } from "../../src/modules/catalog/server/imports";
import { listCatalogItems } from "../../src/modules/catalog/server/catalog";
import { onboardOwner } from "../../src/modules/tenancy/server/onboarding";

async function ownerContext(label: string) {
  const user = await db.user.create({ data: { id: randomUUID(), name: "Import Owner", email: `${label}-${randomUUID()}@example.com`, emailVerified: true } });
  const operation = await onboardOwner({ idempotencyKey: `${label}-${randomUUID()}`, userId: user.id, tenantName: `${label} Tenant`, businessLegalName: `${label} Business LLC` });
  return { userId: user.id, tenantId: operation.tenantId, businessId: operation.businessId, roleKey: "business.owner", tenantName: `${label} Tenant`, businessName: `${label} Business LLC`, planKey: "internal-unlimited", planName: "Internal Unlimited", enabledFeatures: ["catalog.core"] };
}

function csv(rows: string[]) {
  return [
    "type,sku,name,description,unit_code,sales_enabled,purchase_enabled,sales_price,purchase_price,sales_account_class,purchase_account_class,sales_tax_category,purchase_tax_category",
    ...rows,
  ].join("\n");
}

describe("catalog staged imports", () => {
  it("previews and transactionally commits valid create rows", async () => {
    const context = await ownerContext("catalog-import-create");
    const batch = await previewCatalogImport(context, { sourceName: "create.csv", csv: csv(["PRODUCT,IMP-001,Imported Brake Pad,,EA,true,true,125.5000,70.0000,SALES_REVENUE,INVENTORY_PURCHASES,STANDARD_RATE,STANDARD_RATE"]) });
    expect(batch.rows[0].action).toBe("CREATE");
    await commitCatalogImport(context, batch.id);
    expect((await listCatalogItems(context, { query: "IMP-001" }))[0]?.name).toBe("Imported Brake Pad");
    expect((await getCatalogImport(context, batch.id)).status).toBe("COMMITTED");
  });

  it("blocks unresolved SKU conflicts and supports explicit update", async () => {
    const context = await ownerContext("catalog-import-update");
    const unit = await db.unitOfMeasure.findFirstOrThrow({ where: { tenantId: context.tenantId, businessId: context.businessId, code: "EA" } });
    const existing = await db.catalogItem.create({ data: { tenantId: context.tenantId, businessId: context.businessId, type: "PRODUCT", sku: "IMP-002", name: "Old Name", unitId: unit.id, salesEnabled: true, purchaseEnabled: true, defaultSalesPrice: "10", defaultPurchasePrice: "5", salesAccountClassKey: "SALES_REVENUE", purchaseAccountClassKey: "INVENTORY_PURCHASES", defaultSalesTaxCategory: "UNSPECIFIED", defaultPurchaseTaxCategory: "UNSPECIFIED", searchText: "imp-002 old name" } });
    const batch = await previewCatalogImport(context, { sourceName: "update.csv", csv: csv(["PRODUCT,IMP-002,Updated Name,,EA,true,true,20.0000,8.0000,SALES_REVENUE,INVENTORY_PURCHASES,STANDARD_RATE,STANDARD_RATE"]) });
    expect(batch.rows[0]).toMatchObject({ action: "CONFLICT", existingItemId: existing.id });
    await expect(commitCatalogImport(context, batch.id)).rejects.toThrow("CATALOG_IMPORT_UNRESOLVED_ROWS");
    await resolveCatalogImportRow(context, batch.id, batch.rows[0].id, "UPDATE");
    await commitCatalogImport(context, batch.id);
    expect((await db.catalogItem.findUniqueOrThrow({ where: { id: existing.id } })).name).toBe("Updated Name");
  });

  it("detects duplicate file SKUs, invalid units, and supports skip", async () => {
    const context = await ownerContext("catalog-import-conflicts");
    const batch = await previewCatalogImport(context, { sourceName: "conflicts.csv", csv: csv([
      "PRODUCT,IMP-003,First,,EA,true,true,10,5,SALES_REVENUE,INVENTORY_PURCHASES,UNSPECIFIED,UNSPECIFIED",
      "PRODUCT,IMP-003,Second,,EA,true,true,12,6,SALES_REVENUE,INVENTORY_PURCHASES,UNSPECIFIED,UNSPECIFIED",
      "PRODUCT,IMP-004,Unknown Unit,,BAD,true,true,12,6,SALES_REVENUE,INVENTORY_PURCHASES,UNSPECIFIED,UNSPECIFIED",
    ]) });
    expect(batch.rows.map((row) => row.action)).toEqual(["CREATE", "CONFLICT", "INVALID"]);
    await resolveCatalogImportRow(context, batch.id, batch.rows[1].id, "SKIP");
    await expect(commitCatalogImport(context, batch.id)).rejects.toThrow("CATALOG_IMPORT_UNRESOLVED_ROWS");
  });

  it("enforces RBAC, entitlement, and tenant boundaries", async () => {
    const first = await ownerContext("catalog-import-first");
    const second = await ownerContext("catalog-import-second");
    await expect(previewCatalogImport({ ...first, roleKey: "business.viewer" }, { sourceName: "viewer.csv", csv: csv([]) })).rejects.toThrow("BUSINESS_CAPABILITY_DENIED");
    const batch = await previewCatalogImport(first, { sourceName: "scope.csv", csv: csv(["SERVICE,IMP-005,Inspection,,HOUR,true,false,100,,SERVICE_REVENUE,DIRECT_EXPENSE,UNSPECIFIED,UNSPECIFIED"]) });
    await expect(getCatalogImport(second, batch.id)).rejects.toThrow("CATALOG_IMPORT_NOT_FOUND");
    await expect(db.catalogImportRow.create({ data: { tenantId: second.tenantId, businessId: second.businessId, batchId: batch.id, rowNumber: 99, rawData: {}, normalizedData: Prisma.JsonNull, action: "SKIP", existingItemId: null, issues: [] } })).rejects.toThrow();
  });
});
