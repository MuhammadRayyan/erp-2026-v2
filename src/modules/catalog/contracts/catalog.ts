import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || null);
const optionalDecimal = z.string().trim().regex(/^\d{1,15}(?:\.\d{1,4})?$/).optional().or(z.literal("")).transform((value) => value || null);

export const accountClassKeys = [
  "SALES_REVENUE",
  "SERVICE_REVENUE",
  "INVENTORY_PURCHASES",
  "DIRECT_EXPENSE",
  "OPERATING_EXPENSE",
] as const;

export const createUnitSchema = z.object({
  code: z.string().trim().min(1).max(20).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(80),
  symbol: optionalText(20),
  dimension: z.enum(["COUNT", "LENGTH", "AREA", "VOLUME", "MASS", "TIME", "OTHER"]),
  decimalPlaces: z.coerce.number().int().min(0).max(6),
});

export const createCatalogItemSchema = z.object({
  type: z.enum(["PRODUCT", "SERVICE"]),
  sku: z.string().trim().max(60).optional().transform((value) => value ? value.toUpperCase() : null),
  name: z.string().trim().min(2).max(160),
  description: optionalText(2000),
  unitId: z.string().min(1),
  salesEnabled: z.boolean(),
  purchaseEnabled: z.boolean(),
  defaultSalesPrice: optionalDecimal,
  defaultPurchasePrice: optionalDecimal,
  salesAccountClassKey: z.enum(accountClassKeys),
  purchaseAccountClassKey: z.enum(accountClassKeys),
  defaultSalesTaxCategory: z.enum(["UNSPECIFIED", "STANDARD_RATE", "ZERO_RATED", "EXEMPT", "OUT_OF_SCOPE"]),
  defaultPurchaseTaxCategory: z.enum(["UNSPECIFIED", "STANDARD_RATE", "ZERO_RATED", "EXEMPT", "OUT_OF_SCOPE"]),
}).superRefine((value, context) => {
  if (!value.salesEnabled && !value.purchaseEnabled) {
    context.addIssue({ code: "custom", path: ["salesEnabled"], message: "Enable sales, purchases, or both." });
  }
  if (value.type === "SERVICE" && value.salesAccountClassKey === "SALES_REVENUE") {
    context.addIssue({ code: "custom", path: ["salesAccountClassKey"], message: "Services should use the service revenue classification." });
  }
});

export const catalogItemStatusSchema = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) });

export type CreateUnitInput = z.input<typeof createUnitSchema>;
export type CreateCatalogItemInput = z.input<typeof createCatalogItemSchema>;
