CREATE TYPE "ExportFormat" AS ENUM ('CSV');

CREATE TABLE "ExportRun" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "datasetKey" TEXT NOT NULL,
  "format" "ExportFormat" NOT NULL DEFAULT 'CSV',
  "filters" JSONB NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExportRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExportRun_rowCount_check" CHECK ("rowCount" >= 0),
  CONSTRAINT "ExportRun_sha256_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "ExportRun_tenantId_businessId_id_key" ON "ExportRun"("tenantId", "businessId", "id");
CREATE INDEX "ExportRun_dataset_time_idx" ON "ExportRun"("tenantId", "businessId", "datasetKey", "createdAt");
CREATE INDEX "ExportRun_actor_time_idx" ON "ExportRun"("tenantId", "businessId", "requestedById", "createdAt");

ALTER TABLE "ExportRun"
ADD CONSTRAINT "ExportRun_business_scope_fkey"
FOREIGN KEY ("tenantId", "businessId") REFERENCES "Business"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExportRun"
ADD CONSTRAINT "ExportRun_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "FeatureDefinition" ("id", "key", "name", "description", "valueType", "createdAt", "updatedAt")
VALUES ('feature_exports_core', 'exports.core', 'Reusable exports', 'Tenant-scoped CSV exports with explicit filters, row limits, checksums, and audit history.', 'BOOLEAN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "PlanEntitlement" ("id", "planId", "featureId", "enabled", "unlimited", "createdAt", "updatedAt")
SELECT CONCAT('plan_exports_', p."id"), p."id", f."id", true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Plan" p
JOIN "FeatureDefinition" f ON f."key" = 'exports.core'
WHERE p."active" = true
ON CONFLICT ("planId", "featureId") DO NOTHING;
