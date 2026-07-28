import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import type { CreateCatalogItemInput } from "../../src/modules/catalog/contracts/catalog";
import { createCatalogItem, createUnit, listCatalogItems, listUnits } from "../../src/modules/catalog/server/catalog";
import { onboardOwner } from "../../src/modules/tenancy/server/onboarding";

async function ownerContext(label: string) {
  const user = await db.user.create({ data: { id: randomUUID(), name: "Catalog Test Owner", email: `${label}-${randomUUID()}@example.com`, emailVerified: true } });
  const operation = await onboardOwner({ idempotencyKey: `${label}-${randomUUID()}`, userId: user.id, tenantName: `${label} Tenant`, businessLegalName: `${label} Business LLC` });
  return { userId: user.id, tenantId: operation.tenantId, businessId: operation.businessId, roleKey: "business.owner", tenantName: `${label} Tenant`, businessName: `${label} Business LLC`, planKey: "internal-unlimited", planName: "Internal Unlimited", enabledFeatures: ["catalog.core"] };
}

function productInput(unitId: string, overrides: Partial<CreateCatalogItemInput> = {}): CreateCatalogItemInput {
  return {
    type: "PRODUCT",
    sku: `SKU-${randomUUID().slice(0, 8)}`,
    name: "Brake Pad Set",
    description: "Front axle brake pad set",
    unitId,
    salesEnabled: true,
    purchaseEnabled: true,
    defaultSalesPrice: "145.1250",
    defaultPurchasePrice: "82.5000",
    salesAccountClassKey: "SALES_REVENUE",
    purchaseAccountClassKey: "INVENTORY_PURCHASES",
    defaultSalesTaxCategory: "STANDARD_RATE",
    defaultPurchaseTaxCategory: "STANDARD_RATE",
    ...overrides,
  };
}

describe("catalog foundation", () => {
  it("creates default units during onboarding and stores exact decimal prices", async () => {
    const context = await ownerContext("catalog-defaults");
    const units = await listUnits(context);
    expect(units.map((unit) => unit.code).sort()).toEqual(["DAY", "EA", "HOUR"]);
    const each = units.find((unit) => unit.code === "EA")!;
    const item = await createCatalogItem(context, productInput(each.id));
    expect(item.defaultSalesPrice?.toString()).toBe("145.125");
    expect(item.defaultPurchasePrice?.toString()).toBe("82.5");
    expect((await listCatalogItems(context, { query: "brake" }))[0]?.id).toBe(item.id);
  });

  it("creates business-scoped units and rejects duplicate unit codes", async () => {
    const context = await ownerContext("catalog-units");
    await createUnit(context, { code: "M2", name: "Square metre", symbol: "m²", dimension: "AREA", decimalPlaces: 3 });
    await expect(createUnit(context, { code: "m2", name: "Duplicate square metre", dimension: "AREA", decimalPlaces: 3 })).rejects.toThrow();
  });

  it("rejects cross-tenant units for catalog items", async () => {
    const first = await ownerContext("catalog-first");
    const second = await ownerContext("catalog-second");
    const secondUnit = (await listUnits(second))[0];
    await expect(createCatalogItem(first, productInput(secondUnit.id))).rejects.toThrow("CATALOG_UNIT_NOT_FOUND");
  });

  it("enforces catalog management capability and database entitlement", async () => {
    const context = await ownerContext("catalog-access");
    const unit = (await listUnits(context))[0];
    await expect(createCatalogItem({ ...context, roleKey: "business.viewer" }, productInput(unit.id))).rejects.toThrow("BUSINESS_CAPABILITY_DENIED");
    const feature = await db.featureDefinition.findUniqueOrThrow({ where: { key: "catalog.core" } });
    await db.tenantEntitlementOverride.create({ data: { tenantId: context.tenantId, featureId: feature.id, enabled: false, reason: "Integration test" } });
    await expect(listCatalogItems(context)).rejects.toThrow("TENANT_FEATURE_DISABLED");
  });

  it("enforces SKU uniqueness and service revenue classification", async () => {
    const context = await ownerContext("catalog-rules");
    const unit = (await listUnits(context)).find((item) => item.code === "HOUR")!;
    const sku = `SERVICE-${randomUUID().slice(0, 8)}`;
    await expect(createCatalogItem(context, productInput(unit.id, { type: "SERVICE", sku, name: "Inspection labour", salesAccountClassKey: "SALES_REVENUE" }))).rejects.toThrow();
    await createCatalogItem(context, productInput(unit.id, { type: "SERVICE", sku, name: "Inspection labour", salesAccountClassKey: "SERVICE_REVENUE", purchaseAccountClassKey: "DIRECT_EXPENSE" }));
    await expect(createCatalogItem(context, productInput(unit.id, { sku, name: "Duplicate SKU" }))).rejects.toThrow();
  });
});
