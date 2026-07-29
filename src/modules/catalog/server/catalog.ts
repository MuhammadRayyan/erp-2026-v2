import type { BusinessAccessContext } from "@/modules/tenancy/server/context";
import { db } from "@/lib/db";
import { requireBusinessCapability } from "@/modules/access/server/authorize";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";
import {
  catalogItemStatusSchema,
  createCatalogItemSchema,
  createUnitSchema,
  unitStatusSchema,
  updateCatalogItemSchema,
  type CreateCatalogItemInput,
  type CreateUnitInput,
  type UpdateCatalogItemInput,
} from "@/modules/catalog/contracts/catalog";

function normalizeSearch(values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").trim().toLowerCase();
}

async function requireCatalog(context: BusinessAccessContext, capability: "catalog.view" | "catalog.manage") {
  requireBusinessCapability(context, capability);
  await requireTenantFeature(context.tenantId, "catalog.core");
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

export async function setUnitStatus(context: BusinessAccessContext, unitId: string, rawInput: unknown) {
  await requireCatalog(context, "catalog.manage");
  const { active } = unitStatusSchema.parse(rawInput);
  return db.$transaction(async (transaction) => {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "UnitOfMeasure"
      WHERE "id" = ${unitId} AND "tenantId" = ${context.tenantId} AND "businessId" = ${context.businessId}
      FOR UPDATE
    `;
    if (!locked[0]) throw new Error("CATALOG_UNIT_NOT_FOUND");
    if (!active) {
      const inUse = await transaction.catalogItem.count({
        where: { tenantId: context.tenantId, businessId: context.businessId, unitId, status: "ACTIVE" },
      });
      if (inUse > 0) throw new Error("CATALOG_UNIT_IN_USE");
    }
    return transaction.unitOfMeasure.update({ where: { id: unitId }, data: { active } });
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

export async function getCatalogItem(context: BusinessAccessContext, itemId: string) {
  await requireCatalog(context, "catalog.view");
  const item = await db.catalogItem.findFirst({
    where: { id: itemId, tenantId: context.tenantId, businessId: context.businessId },
    include: { unit: true },
  });
  if (!item) throw new Error("CATALOG_ITEM_NOT_FOUND");
  return item;
}

export async function createCatalogItem(context: BusinessAccessContext, rawInput: CreateCatalogItemInput) {
  await requireCatalog(context, "catalog.manage");
  const input = createCatalogItemSchema.parse(rawInput);
  return db.$transaction(async (transaction) => {
    const unit = await transaction.$queryRaw<Array<{ id: string; active: boolean }>>`
      SELECT "id", "active" FROM "UnitOfMeasure"
      WHERE "id" = ${input.unitId} AND "tenantId" = ${context.tenantId} AND "businessId" = ${context.businessId}
      FOR UPDATE
    `;
    if (!unit[0]?.active) throw new Error("CATALOG_UNIT_NOT_FOUND");
    return transaction.catalogItem.create({
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
  });
}

export async function updateCatalogItem(context: BusinessAccessContext, itemId: string, rawInput: UpdateCatalogItemInput) {
  await requireCatalog(context, "catalog.manage");
  const input = updateCatalogItemSchema.parse(rawInput);
  return db.$transaction(async (transaction) => {
    const lockedItem = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "CatalogItem"
      WHERE "id" = ${itemId} AND "tenantId" = ${context.tenantId} AND "businessId" = ${context.businessId}
      FOR UPDATE
    `;
    if (!lockedItem[0]) throw new Error("CATALOG_ITEM_NOT_FOUND");
    const unit = await transaction.$queryRaw<Array<{ id: string; active: boolean }>>`
      SELECT "id", "active" FROM "UnitOfMeasure"
      WHERE "id" = ${input.unitId} AND "tenantId" = ${context.tenantId} AND "businessId" = ${context.businessId}
      FOR UPDATE
    `;
    if (!unit[0]?.active) throw new Error("CATALOG_UNIT_NOT_FOUND");
    return transaction.catalogItem.update({
      where: { id: itemId },
      data: {
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
  });
}

export async function setCatalogItemStatus(context: BusinessAccessContext, itemId: string, rawInput: unknown) {
  await requireCatalog(context, "catalog.manage");
  const { status } = catalogItemStatusSchema.parse(rawInput);
  return db.$transaction(async (transaction) => {
    const items = await transaction.$queryRaw<Array<{ id: string; unitId: string }>>`
      SELECT "id", "unitId" FROM "CatalogItem"
      WHERE "id" = ${itemId} AND "tenantId" = ${context.tenantId} AND "businessId" = ${context.businessId}
      FOR UPDATE
    `;
    const item = items[0];
    if (!item) throw new Error("CATALOG_ITEM_NOT_FOUND");
    if (status === "ACTIVE") {
      const units = await transaction.$queryRaw<Array<{ id: string; active: boolean }>>`
        SELECT "id", "active" FROM "UnitOfMeasure"
        WHERE "id" = ${item.unitId} AND "tenantId" = ${context.tenantId} AND "businessId" = ${context.businessId}
        FOR UPDATE
      `;
      if (!units[0]?.active) throw new Error("CATALOG_UNIT_NOT_FOUND");
    }
    return transaction.catalogItem.update({ where: { id: itemId }, data: { status } });
  });
}
