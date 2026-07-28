CREATE TYPE "NumberResetPolicy" AS ENUM ('NEVER', 'YEARLY', 'MONTHLY');
CREATE TYPE "NumberAllocationStatus" AS ENUM ('ALLOCATED', 'VOIDED');

CREATE TABLE "NumberSequence" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "prefixTemplate" TEXT NOT NULL DEFAULT '',
  "suffixTemplate" TEXT NOT NULL DEFAULT '',
  "padding" INTEGER NOT NULL DEFAULT 5,
  "startValue" INTEGER NOT NULL DEFAULT 1,
  "nextValue" INTEGER NOT NULL DEFAULT 1,
  "resetPolicy" "NumberResetPolicy" NOT NULL DEFAULT 'YEARLY',
  "currentPeriodKey" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NumberSequence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NumberSequence_padding_check" CHECK ("padding" BETWEEN 1 AND 12),
  CONSTRAINT "NumberSequence_values_check" CHECK ("startValue" > 0 AND "nextValue" > 0),
  CONSTRAINT "NumberSequence_key_check" CHECK ("key" ~ '^[A-Z][A-Z0-9_]{1,79}$')
);

CREATE TABLE "NumberAllocation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "sequenceId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "effectiveDate" DATE NOT NULL,
  "periodKey" TEXT NOT NULL,
  "numericValue" INTEGER NOT NULL,
  "formattedValue" TEXT NOT NULL,
  "status" "NumberAllocationStatus" NOT NULL DEFAULT 'ALLOCATED',
  "referenceType" TEXT,
  "referenceId" TEXT,
  "allocatedById" TEXT NOT NULL,
  "voidedAt" TIMESTAMP(3),
  "voidedById" TEXT,
  "voidReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NumberAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NumberAllocation_numeric_check" CHECK ("numericValue" > 0),
  CONSTRAINT "NumberAllocation_void_check" CHECK (("status" = 'ALLOCATED' AND "voidedAt" IS NULL AND "voidedById" IS NULL AND "voidReason" IS NULL) OR ("status" = 'VOIDED' AND "voidedAt" IS NOT NULL AND "voidedById" IS NOT NULL AND length(trim("voidReason")) >= 3))
);

CREATE UNIQUE INDEX "NumberSequence_tenantId_businessId_id_key" ON "NumberSequence"("tenantId", "businessId", "id");
CREATE UNIQUE INDEX "NumberSequence_scope_key" ON "NumberSequence"("tenantId", "businessId", "key");
CREATE INDEX "NumberSequence_scope_active_idx" ON "NumberSequence"("tenantId", "businessId", "active", "label");
CREATE UNIQUE INDEX "NumberAllocation_idempotency_key" ON "NumberAllocation"("tenantId", "businessId", "sequenceId", "idempotencyKey");
CREATE UNIQUE INDEX "NumberAllocation_formatted_key" ON "NumberAllocation"("tenantId", "businessId", "sequenceId", "formattedValue");
CREATE UNIQUE INDEX "NumberAllocation_numeric_period_key" ON "NumberAllocation"("tenantId", "businessId", "sequenceId", "periodKey", "numericValue");
CREATE INDEX "NumberAllocation_sequence_created_idx" ON "NumberAllocation"("tenantId", "businessId", "sequenceId", "createdAt");
CREATE INDEX "NumberAllocation_reference_idx" ON "NumberAllocation"("tenantId", "businessId", "referenceType", "referenceId");

ALTER TABLE "NumberSequence"
ADD CONSTRAINT "NumberSequence_business_scope_fkey"
FOREIGN KEY ("tenantId", "businessId") REFERENCES "Business"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NumberAllocation"
ADD CONSTRAINT "NumberAllocation_sequence_scope_fkey"
FOREIGN KEY ("tenantId", "businessId", "sequenceId") REFERENCES "NumberSequence"("tenantId", "businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NumberAllocation"
ADD CONSTRAINT "NumberAllocation_allocatedById_fkey"
FOREIGN KEY ("allocatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NumberAllocation"
ADD CONSTRAINT "NumberAllocation_voidedById_fkey"
FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "NumberSequence" ("id", "tenantId", "businessId", "key", "label", "prefixTemplate", "padding", "startValue", "nextValue", "resetPolicy", "createdAt", "updatedAt")
SELECT CONCAT('seq_', substr(md5(b."id" || defaults.key), 1, 24)), b."tenantId", b."id", defaults.key, defaults.label, defaults.prefix, 5, 1, 1, 'YEARLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Business" b
CROSS JOIN (VALUES
  ('QUOTATION', 'Quotation', 'Q-{YYYY}-'),
  ('SALES_ORDER', 'Sales order', 'SO-{YYYY}-'),
  ('SALES_INVOICE', 'Sales invoice', 'INV-{YYYY}-'),
  ('PURCHASE_ORDER', 'Purchase order', 'PO-{YYYY}-'),
  ('SUPPLIER_INVOICE', 'Supplier invoice', 'BILL-{YYYY}-'),
  ('RECEIPT', 'Receipt', 'RCPT-{YYYY}-'),
  ('PAYMENT', 'Payment', 'PAY-{YYYY}-')
) AS defaults(key, label, prefix)
ON CONFLICT ("tenantId", "businessId", "key") DO NOTHING;
