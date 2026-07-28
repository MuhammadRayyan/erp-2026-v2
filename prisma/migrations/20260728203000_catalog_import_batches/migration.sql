CREATE TYPE "CatalogImportStatus" AS ENUM ('PREVIEW', 'COMMITTED', 'CANCELLED');
CREATE TYPE "CatalogImportAction" AS ENUM ('CREATE', 'UPDATE', 'SKIP', 'CONFLICT', 'INVALID');

CREATE TABLE "CatalogImportBatch" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "status" "CatalogImportStatus" NOT NULL DEFAULT 'PREVIEW',
  "totalRows" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "committedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "CatalogImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogImportRow" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "rawData" JSONB NOT NULL,
  "normalizedData" JSONB,
  "action" "CatalogImportAction" NOT NULL,
  "existingItemId" TEXT,
  "issues" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogImportRow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogImportBatch_tenantId_businessId_id_key" ON "CatalogImportBatch"("tenantId", "businessId", "id");
CREATE INDEX "CatalogImportBatch_tenantId_businessId_status_createdAt_idx" ON "CatalogImportBatch"("tenantId", "businessId", "status", "createdAt");
CREATE UNIQUE INDEX "CatalogImportRow_batchId_rowNumber_key" ON "CatalogImportRow"("batchId", "rowNumber");
CREATE INDEX "CatalogImportRow_tenantId_businessId_batchId_action_idx" ON "CatalogImportRow"("tenantId", "businessId", "batchId", "action");
CREATE INDEX "CatalogImportRow_tenantId_businessId_existingItemId_idx" ON "CatalogImportRow"("tenantId", "businessId", "existingItemId");

ALTER TABLE "CatalogImportBatch"
ADD CONSTRAINT "CatalogImportBatch_business_scope_fkey"
FOREIGN KEY ("tenantId", "businessId") REFERENCES "Business"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogImportBatch"
ADD CONSTRAINT "CatalogImportBatch_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CatalogImportRow"
ADD CONSTRAINT "CatalogImportRow_batch_scope_fkey"
FOREIGN KEY ("tenantId", "businessId", "batchId") REFERENCES "CatalogImportBatch"("tenantId", "businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogImportRow"
ADD CONSTRAINT "CatalogImportRow_existing_item_scope_fkey"
FOREIGN KEY ("tenantId", "businessId", "existingItemId") REFERENCES "CatalogItem"("tenantId", "businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
