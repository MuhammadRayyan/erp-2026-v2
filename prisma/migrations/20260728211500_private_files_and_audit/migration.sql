CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'S3');
CREATE TYPE "StoredFileStatus" AS ENUM ('AVAILABLE', 'QUARANTINED', 'DELETED');

CREATE TABLE "StoredFile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "storageProvider" "StorageProvider" NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "safeName" TEXT NOT NULL,
  "extension" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "status" "StoredFileStatus" NOT NULL DEFAULT 'AVAILABLE',
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoredFile_size_check" CHECK ("sizeBytes" > 0),
  CONSTRAINT "StoredFile_sha256_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "FileAttachment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "fileId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FileAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoredFile_tenantId_businessId_id_key" ON "StoredFile"("tenantId", "businessId", "id");
CREATE UNIQUE INDEX "StoredFile_storageProvider_storageKey_key" ON "StoredFile"("storageProvider", "storageKey");
CREATE INDEX "StoredFile_tenantId_businessId_status_createdAt_idx" ON "StoredFile"("tenantId", "businessId", "status", "createdAt");
CREATE INDEX "StoredFile_tenantId_businessId_sha256_idx" ON "StoredFile"("tenantId", "businessId", "sha256");
CREATE UNIQUE INDEX "FileAttachment_scope_key" ON "FileAttachment"("tenantId", "businessId", "fileId", "entityType", "entityId");
CREATE INDEX "FileAttachment_entity_idx" ON "FileAttachment"("tenantId", "businessId", "entityType", "entityId");
CREATE INDEX "AuditEvent_scope_time_idx" ON "AuditEvent"("tenantId", "businessId", "occurredAt");
CREATE INDEX "AuditEvent_entity_time_idx" ON "AuditEvent"("tenantId", "businessId", "entityType", "entityId", "occurredAt");
CREATE INDEX "AuditEvent_actor_time_idx" ON "AuditEvent"("tenantId", "businessId", "actorUserId", "occurredAt");

ALTER TABLE "StoredFile"
ADD CONSTRAINT "StoredFile_business_scope_fkey"
FOREIGN KEY ("tenantId", "businessId") REFERENCES "Business"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoredFile"
ADD CONSTRAINT "StoredFile_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FileAttachment"
ADD CONSTRAINT "FileAttachment_file_scope_fkey"
FOREIGN KEY ("tenantId", "businessId", "fileId") REFERENCES "StoredFile"("tenantId", "businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditEvent"
ADD CONSTRAINT "AuditEvent_business_scope_fkey"
FOREIGN KEY ("tenantId", "businessId") REFERENCES "Business"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditEvent"
ADD CONSTRAINT "AuditEvent_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
