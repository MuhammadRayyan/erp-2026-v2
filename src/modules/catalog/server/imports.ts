import type { BusinessAccessContext } from "@/modules/tenancy/server/context";
import { db } from "@/lib/db";
import { requireBusinessCapability } from "@/modules/access/server/authorize";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";
import { createCatalogItemSchema } from "@/modules/catalog/contracts/catalog";
import { csvRecords } from "@/modules/catalog/imports/csv";

const requiredHeaders = ["type", "sku", "name", "unit_code", "sales_enabled", "purchase_enabled", "sales_price", "purchase_price", "sales_account_class", "purchase_account_class", "sales_tax_category", "purchase_tax_category"] as const;

type ImportAction = "CREATE" | "UPDATE" | "SKIP" | "CONFLICT" | "INVALID";

function bool(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  throw new Error("Expected true or false.");
}

function normalizedName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

async function requireImportAccess(context: BusinessAccessContext, capability: "catalog.view" | "catalog.manage") {
  requireBusinessCapability(context, capability);
  await requireTenantFeature(context.tenantId, "catalog.core");
}

export async function previewCatalogImport(context: BusinessAccessContext, input: { sourceName: string; csv: string }) {
  await requireImportAccess(context, "catalog.manage");
  const records = csvRecords(input.csv);
  if (records.length > 2_000) throw new Error("CATALOG_IMPORT_TOO_LARGE");
  const first = records[0]?.data ?? {};
  const missingHeaders = requiredHeaders.filter((header) => !(header in first));
  if (missingHeaders.length) throw new Error(`CATALOG_IMPORT_MISSING_HEADERS:${missingHeaders.join(",")}`);

  const [units, existingItems] = await Promise.all([
    db.unitOfMeasure.findMany({ where: { tenantId: context.tenantId, businessId: context.businessId, active: true } }),
    db.catalogItem.findMany({ where: { tenantId: context.tenantId, businessId: context.businessId }, select: { id: true, sku: true, name: true } }),
  ]);
  const unitByCode = new Map(units.map((unit) => [unit.code.toUpperCase(), unit]));
  const itemBySku = new Map(existingItems.filter((item) => item.sku).map((item) => [item.sku!, item]));
  const itemByName = new Map(existingItems.map((item) => [normalizedName(item.name), item]));
  const fileSkus = new Set<string>();

  const rows = records.map(({ rowNumber, data }) => {
    const issues: string[] = [];
    let action: ImportAction = "CREATE";
    let existingItemId: string | null = null;
    let normalized: Record<string, unknown> | null = null;
    try {
      const sku = data.sku.trim().toUpperCase() || null;
      const unit = unitByCode.get(data.unit_code.trim().toUpperCase());
      if (!unit) throw new Error("Unknown or inactive unit code.");
      normalized = createCatalogItemSchema.parse({
        type: data.type.trim().toUpperCase(),
        sku,
        name: data.name,
        description: data.description ?? "",
        unitId: unit.id,
        salesEnabled: bool(data.sales_enabled),
        purchaseEnabled: bool(data.purchase_enabled),
        defaultSalesPrice: data.sales_price,
        defaultPurchasePrice: data.purchase_price,
        salesAccountClassKey: data.sales_account_class.trim().toUpperCase(),
        purchaseAccountClassKey: data.purchase_account_class.trim().toUpperCase(),
        defaultSalesTaxCategory: data.sales_tax_category.trim().toUpperCase(),
        defaultPurchaseTaxCategory: data.purchase_tax_category.trim().toUpperCase(),
      });
      if (sku) {
        if (fileSkus.has(sku)) {
          action = "CONFLICT";
          issues.push("Duplicate SKU appears more than once in this file.");
        }
        fileSkus.add(sku);
        const existing = itemBySku.get(sku);
        if (existing) {
          action = "CONFLICT";
          existingItemId = existing.id;
          issues.push("SKU already exists. Choose update or skip.");
        }
      }
      if (!existingItemId) {
        const nameMatch = itemByName.get(normalizedName(String(normalized.name)));
        if (nameMatch) {
          action = "CONFLICT";
          existingItemId = nameMatch.id;
          issues.push("An item with the same normalized name already exists.");
        }
      }
    } catch (error) {
      action = "INVALID";
      issues.push(error instanceof Error ? error.message : "Invalid row.");
    }
    return { rowNumber, rawData: data, normalizedData: normalized, action, existingItemId, issues };
  });

  return db.catalogImportBatch.create({
    data: {
      tenantId: context.tenantId,
      businessId: context.businessId,
      createdById: context.userId,
      sourceName: input.sourceName.trim().slice(0, 160) || "catalog.csv",
      totalRows: rows.length,
      rows: { create: rows.map((row) => ({ tenantId: context.tenantId, businessId: context.businessId, ...row })) },
    },
    include: { rows: { orderBy: { rowNumber: "asc" } } },
  });
}

export async function getCatalogImport(context: BusinessAccessContext, batchId: string) {
  await requireImportAccess(context, "catalog.view");
  const batch = await db.catalogImportBatch.findFirst({
    where: { id: batchId, tenantId: context.tenantId, businessId: context.businessId },
    include: { rows: { orderBy: { rowNumber: "asc" } } },
  });
  if (!batch) throw new Error("CATALOG_IMPORT_NOT_FOUND");
  return batch;
}

export async function resolveCatalogImportRow(context: BusinessAccessContext, batchId: string, rowId: string, action: "CREATE" | "UPDATE" | "SKIP") {
  await requireImportAccess(context, "catalog.manage");
  const row = await db.catalogImportRow.findFirst({ where: { id: rowId, batchId, tenantId: context.tenantId, businessId: context.businessId }, include: { batch: true } });
  if (!row || row.batch.status !== "PREVIEW") throw new Error("CATALOG_IMPORT_ROW_NOT_FOUND");
  if (row.action === "INVALID") throw new Error("CATALOG_IMPORT_ROW_INVALID");
  if (action === "UPDATE" && !row.existingItemId) throw new Error("CATALOG_IMPORT_UPDATE_TARGET_MISSING");
  return db.catalogImportRow.update({ where: { id: row.id }, data: { action } });
}

export async function commitCatalogImport(context: BusinessAccessContext, batchId: string) {
  await requireImportAccess(context, "catalog.manage");
  return db.$transaction(async (transaction) => {
    const batches = await transaction.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT "id", "status"::text FROM "CatalogImportBatch"
      WHERE "id" = ${batchId} AND "tenantId" = ${context.tenantId} AND "businessId" = ${context.businessId}
      FOR UPDATE
    `;
    const batch = batches[0];
    if (!batch) throw new Error("CATALOG_IMPORT_NOT_FOUND");
    if (batch.status !== "PREVIEW") throw new Error("CATALOG_IMPORT_ALREADY_FINALIZED");
    const rows = await transaction.catalogImportRow.findMany({ where: { batchId, tenantId: context.tenantId, businessId: context.businessId }, orderBy: { rowNumber: "asc" } });
    if (rows.some((row) => row.action === "CONFLICT" || row.action === "INVALID")) throw new Error("CATALOG_IMPORT_UNRESOLVED_ROWS");

    for (const row of rows) {
      if (row.action === "SKIP") continue;
      const data = createCatalogItemSchema.parse(row.normalizedData);
      const lockedUnits = await transaction.$queryRaw<Array<{ id: string; active: boolean }>>`
        SELECT "id", "active" FROM "UnitOfMeasure"
        WHERE "id" = ${data.unitId} AND "tenantId" = ${context.tenantId} AND "businessId" = ${context.businessId}
        FOR UPDATE
      `;
      if (!lockedUnits[0]?.active) throw new Error("CATALOG_UNIT_NOT_FOUND");
      const values = {
        type: data.type,
        sku: data.sku,
        name: data.name,
        description: data.description,
        unitId: data.unitId,
        salesEnabled: data.salesEnabled,
        purchaseEnabled: data.purchaseEnabled,
        defaultSalesPrice: data.defaultSalesPrice,
        defaultPurchasePrice: data.defaultPurchasePrice,
        salesAccountClassKey: data.salesAccountClassKey,
        purchaseAccountClassKey: data.purchaseAccountClassKey,
        defaultSalesTaxCategory: data.defaultSalesTaxCategory,
        defaultPurchaseTaxCategory: data.defaultPurchaseTaxCategory,
        searchText: [data.sku, data.name, data.description].filter(Boolean).join(" ").toLowerCase(),
      };
      if (row.action === "UPDATE") {
        await transaction.catalogItem.updateMany({ where: { id: row.existingItemId!, tenantId: context.tenantId, businessId: context.businessId }, data: values });
      } else {
        await transaction.catalogItem.create({ data: { tenantId: context.tenantId, businessId: context.businessId, ...values } });
      }
    }
    await transaction.catalogImportBatch.update({ where: { id: batchId }, data: { status: "COMMITTED", committedAt: new Date() } });
    return { imported: rows.filter((row) => row.action === "CREATE").length, updated: rows.filter((row) => row.action === "UPDATE").length, skipped: rows.filter((row) => row.action === "SKIP").length };
  });
}
