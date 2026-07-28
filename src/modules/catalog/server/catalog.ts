import type { BusinessAccessContext } from "@/modules/tenancy/server/context";
import { db } from "@/lib/db";
import { requireBusinessCapability } from "@/modules/access/server/authorize";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";
import {
  catalogItemStatusSchema,
  createCatalogItemSchema,
  createUnitSchema,
  type CreateCatalogItemInput,
  type CreateUnitInput,
} from "@/modules/catalog/contracts/catalog";

function normalizeSearch(values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").trim().toLowerCase();
}

async function requireCatalog(context: BusinessAccessContext, capability: "catalog.view" | "catalog.manage") {
  requireBusinessCapability(context, capability);
  await requireTenantFeature(context.tenantId, "catalog.core");
}

async function requireScopedUnit(context: BusinessAccessContext, unitId: string) {
  const unit = await db.unitOfMeasure.findFirst({
    where: { id: unitId, tenantId: context.tenantId, businessId: context.businessId, active: true },
  });
  if (!unit) throw new Error("CATALOG_UNIT_NOT_FOUND");
  return unit;
}

export async function listUnits(context: BusinessAccessContext) {
  await requireCatalog(context, "catalog.view");
  return db.unitOfMeasure.findMany({
    where: { tenantId: context.tenantId, businessId: context.businessId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

export async function createUnit(context: BusinessAccessContext, rawInput: CreateUnitInput) {
  await requireCatalog(context, "catalog.manage");
  const input = createUnitSchema.parse(rawInput);
  return db.unitOfMeasure.create({
    data: {
      tenantId: context.tenantId,
      businessId: context.businessId,
      code: input.code,
      name: input.name,
      symbol: input.symbol,
      dimension: input.dimension,
      decimalPlaces: input.decimalPlaces,
    },
  });
}

export async function listCatalogItems(
  context: BusinessAccessContext,
  options: { query?: string; type?: "PRODUCT" | "SERVICE"; status?: "ACTIVE" | "INACTIVE" } = {},
) {
  await requireCatalog(context, "catalog.view");
  const query = options.query?.trim().toLowerCase();
  return db.catalogItem.findMany({
    where: {
      tenantId: context.tenantId,
      businessId: context.businessId,
      ...(query ? { searchText: { contains: query } } : {}),
      ...(options.type ? { type: options.type } : {}),
      ...(options.status ? { status: options.status } : {}),
    },
    include: { unit: true },
    orderBy: [{ status: "asc" }, { type: "asc" }, { name: "asc" }],
    take: 200,
  });
}

export async function createCatalogItem(context: BusinessAccessContext, rawInput: CreateCatalogItemInput) {
  await requireCatalog(context, "catalog.manage");
  const input = createCatalogItemSchema.parse(rawInput);
  await requireScopedUnit(context, input.unitId);
  return db.catalogItem.create({
    data: {
      tenantId: context.tenantId,
      businessId: context.businessId,
      type: input.type,
      sku: input.sku,
      name: input.name,
      description: input.description,
      unitId: input.unitId,
      salesEnabled: input.salesEnabled,
      purchaseEnabled: input.purchaseEnabled,
      defaultSalesPrice: input.defaultSalesPrice,
      defaultPurchasePrice: input.defaultPurchasePrice,
      salesAccountClassKey: input.salesAccountClassKey,
      purchaseAccountClassKey: input.purchaseAccountClassKey,
      defaultSalesTaxCategory: input.defaultSalesTaxCategory,
      defaultPurchaseTaxCategory: input.defaultPurchaseTaxCategory,
      searchText: normalizeSearch([input.sku, input.name, input.description]),
    },
    include: { unit: true },
  });
}

export async function setCatalogItemStatus(context: BusinessAccessContext, itemId: string, rawInput: unknown) {
  await requireCatalog(context, "catalog.manage");
  const item = await db.catalogItem.findFirst({
    where: { id: itemId, tenantId: context.tenantId, businessId: context.businessId },
  });
  if (!item) throw new Error("CATALOG_ITEM_NOT_FOUND");
  const { status } = catalogItemStatusSchema.parse(rawInput);
  return db.catalogItem.update({ where: { id: itemId }, data: { status } });
}
