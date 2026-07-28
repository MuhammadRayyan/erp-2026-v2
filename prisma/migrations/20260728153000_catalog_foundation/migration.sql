CREATE TYPE "CatalogItemType" AS ENUM ('PRODUCT', 'SERVICE');
CREATE TYPE "CatalogItemStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "UnitDimension" AS ENUM ('COUNT', 'LENGTH', 'AREA', 'VOLUME', 'MASS', 'TIME', 'OTHER');
CREATE TYPE "CatalogTaxCategory" AS ENUM ('UNSPECIFIED', 'STANDARD_RATE', 'ZERO_RATED', 'EXEMPT', 'OUT_OF_SCOPE');

CREATE TABLE "UnitOfMeasure" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "symbol" TEXT,
  "dimension" "UnitDimension" NOT NULL DEFAULT 'OTHER',
  "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UnitOfMeasure_decimal_places_check" CHECK ("decimalPlaces" BETWEEN 0 AND 6)
);

CREATE TABLE "CatalogItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "type" "CatalogItemType" NOT NULL,
  "status" "CatalogItemStatus" NOT NULL DEFAULT 'ACTIVE',
  "sku" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "unitId" TEXT NOT NULL,
  "salesEnabled" BOOLEAN NOT NULL DEFAULT true,
  "purchaseEnabled" BOOLEAN NOT NULL DEFAULT true,
  "defaultSalesPrice" DECIMAL(19,4),
  "defaultPurchasePrice" DECIMAL(19,4),
  "salesAccountClassKey" TEXT NOT NULL,
  "purchaseAccountClassKey" TEXT NOT NULL,
  "defaultSalesTaxCategory" "CatalogTaxCategory" NOT NULL DEFAULT 'UNSPECIFIED',
  "defaultPurchaseTaxCategory" "CatalogTaxCategory" NOT NULL DEFAULT 'UNSPECIFIED',
  "searchText" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CatalogItem_sales_price_nonnegative" CHECK ("defaultSalesPrice" IS NULL OR "defaultSalesPrice" >= 0),
  CONSTRAINT "CatalogItem_purchase_price_nonnegative" CHECK ("defaultPurchasePrice" IS NULL OR "defaultPurchasePrice" >= 0),
  CONSTRAINT "CatalogItem_channel_check" CHECK ("salesEnabled" OR "purchaseEnabled")
);

CREATE UNIQUE INDEX "UnitOfMeasure_tenantId_businessId_id_key" ON "UnitOfMeasure"("tenantId", "businessId", "id");
CREATE UNIQUE INDEX "UnitOfMeasure_tenantId_businessId_code_key" ON "UnitOfMeasure"("tenantId", "businessId", "code");
CREATE INDEX "UnitOfMeasure_tenantId_businessId_active_name_idx" ON "UnitOfMeasure"("tenantId", "businessId", "active", "name");
CREATE UNIQUE INDEX "CatalogItem_tenantId_businessId_id_key" ON "CatalogItem"("tenantId", "businessId", "id");
CREATE UNIQUE INDEX "CatalogItem_tenantId_businessId_sku_key" ON "CatalogItem"("tenantId", "businessId", "sku");
CREATE INDEX "CatalogItem_tenantId_businessId_status_type_name_idx" ON "CatalogItem"("tenantId", "businessId", "status", "type", "name");
CREATE INDEX "CatalogItem_tenantId_businessId_unitId_idx" ON "CatalogItem"("tenantId", "businessId", "unitId");

ALTER TABLE "UnitOfMeasure"
  ADD CONSTRAINT "UnitOfMeasure_business_fkey"
  FOREIGN KEY ("tenantId", "businessId") REFERENCES "Business"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogItem"
  ADD CONSTRAINT "CatalogItem_business_fkey"
  FOREIGN KEY ("tenantId", "businessId") REFERENCES "Business"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogItem"
  ADD CONSTRAINT "CatalogItem_unit_fkey"
  FOREIGN KEY ("tenantId", "businessId", "unitId") REFERENCES "UnitOfMeasure"("tenantId", "businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "UnitOfMeasure" ("id", "tenantId", "businessId", "code", "name", "symbol", "dimension", "decimalPlaces", "active", "createdAt", "updatedAt")
SELECT CONCAT('uom_each_', b."id"), b."tenantId", b."id", 'EA', 'Each', 'ea', 'COUNT', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Business" b
ON CONFLICT ("tenantId", "businessId", "code") DO NOTHING;

INSERT INTO "UnitOfMeasure" ("id", "tenantId", "businessId", "code", "name", "symbol", "dimension", "decimalPlaces", "active", "createdAt", "updatedAt")
SELECT CONCAT('uom_hour_', b."id"), b."tenantId", b."id", 'HOUR', 'Hour', 'hr', 'TIME', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Business" b
ON CONFLICT ("tenantId", "businessId", "code") DO NOTHING;

INSERT INTO "UnitOfMeasure" ("id", "tenantId", "businessId", "code", "name", "symbol", "dimension", "decimalPlaces", "active", "createdAt", "updatedAt")
SELECT CONCAT('uom_day_', b."id"), b."tenantId", b."id", 'DAY', 'Day', 'day', 'TIME', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Business" b
ON CONFLICT ("tenantId", "businessId", "code") DO NOTHING;
