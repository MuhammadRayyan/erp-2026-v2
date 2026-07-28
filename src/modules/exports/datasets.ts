import { z } from "zod";
import { db } from "@/lib/db";
import type { BusinessCapability } from "@/modules/access/roles";
import type { BusinessAccessContext } from "@/modules/tenancy/server/context";
import type { CsvValue } from "@/modules/exports/csv";

export const EXPORT_ROW_LIMIT = 5000;

const commonText = z.string().trim().max(160).optional().transform((value) => value || undefined);

const partyFiltersSchema = z.object({
  q: commonText,
  role: z.enum(["CUSTOMER", "SUPPLIER"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

const catalogFiltersSchema = z.object({
  q: commonText,
  type: z.enum(["PRODUCT", "SERVICE"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type ExportDatasetKey = "parties" | "catalog";

type ExportDataset = {
  label: string;
  capability: BusinessCapability;
  parseFilters(input: unknown): Record<string, string | undefined>;
  headers: string[];
  load(context: BusinessAccessContext, filters: Record<string, string | undefined>): Promise<CsvValue[][]>;
};

export const exportDatasets: Record<ExportDatasetKey, ExportDataset> = {
  parties: {
    label: "Parties",
    capability: "parties.view",
    parseFilters(input) {
      return partyFiltersSchema.parse(input);
    },
    headers: ["Party ID", "Display name", "Type", "Status", "Roles", "Email", "Phone", "TRN", "Primary contact", "Address type", "Address", "City", "Emirate", "Country", "Created at", "Updated at"],
    async load(context, filters) {
      const query = filters.q?.toLowerCase();
      const rows = await db.party.findMany({
        where: {
          tenantId: context.tenantId,
          businessId: context.businessId,
          ...(query ? { searchText: { contains: query } } : {}),
          ...(filters.role ? { roles: { some: { role: filters.role as "CUSTOMER" | "SUPPLIER" } } } : {}),
          ...(filters.status ? { status: filters.status as "ACTIVE" | "INACTIVE" } : {}),
        },
        include: {
          roles: { orderBy: { role: "asc" } },
          contacts: { where: { isPrimary: true }, take: 1 },
          addresses: { where: { isDefault: true }, orderBy: { type: "asc" }, take: 1 },
        },
        orderBy: [{ displayName: "asc" }, { id: "asc" }],
        take: EXPORT_ROW_LIMIT + 1,
      });
      return rows.map((party) => {
        const contact = party.contacts[0];
        const address = party.addresses[0];
        return [
          party.id,
          party.displayName,
          party.type,
          party.status,
          party.roles.map(({ role }) => role).join("|"),
          party.email || contact?.email,
          party.phone || contact?.phone,
          party.taxRegistrationNumber,
          contact?.name,
          address?.type,
          address ? [address.line1, address.line2].filter(Boolean).join(", ") : null,
          address?.city,
          address?.emirate,
          address?.countryCode,
          party.createdAt,
          party.updatedAt,
        ];
      });
    },
  },
  catalog: {
    label: "Catalog",
    capability: "catalog.view",
    parseFilters(input) {
      return catalogFiltersSchema.parse(input);
    },
    headers: ["Item ID", "SKU", "Name", "Description", "Type", "Status", "Unit code", "Unit name", "Sales enabled", "Purchase enabled", "Default sales price", "Default purchase price", "Sales account class", "Purchase account class", "Sales tax category", "Purchase tax category", "Created at", "Updated at"],
    async load(context, filters) {
      const query = filters.q?.toLowerCase();
      const rows = await db.catalogItem.findMany({
        where: {
          tenantId: context.tenantId,
          businessId: context.businessId,
          ...(query ? { searchText: { contains: query } } : {}),
          ...(filters.type ? { type: filters.type as "PRODUCT" | "SERVICE" } : {}),
          ...(filters.status ? { status: filters.status as "ACTIVE" | "INACTIVE" } : {}),
        },
        include: { unit: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: EXPORT_ROW_LIMIT + 1,
      });
      return rows.map((item) => [
        item.id,
        item.sku,
        item.name,
        item.description,
        item.type,
        item.status,
        item.unit.code,
        item.unit.name,
        item.salesEnabled,
        item.purchaseEnabled,
        item.defaultSalesPrice?.toString(),
        item.defaultPurchasePrice?.toString(),
        item.salesAccountClassKey,
        item.purchaseAccountClassKey,
        item.defaultSalesTaxCategory,
        item.defaultPurchaseTaxCategory,
        item.createdAt,
        item.updatedAt,
      ]);
    },
  },
};

export function getExportDataset(key: string): [ExportDatasetKey, ExportDataset] {
  if (key !== "parties" && key !== "catalog") throw new Error("EXPORT_DATASET_NOT_FOUND");
  return [key, exportDatasets[key]];
}
