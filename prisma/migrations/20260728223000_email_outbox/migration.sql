CREATE TYPE "EmailOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'RETRY', 'SENT', 'FAILED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "EmailOutboxCategory" AS ENUM ('TENANT_INVITATION', 'PASSWORD_RESET', 'SYSTEM');

CREATE TABLE "EmailOutbox" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "category" "EmailOutboxCategory" NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "textBody" TEXT,
  "htmlBody" TEXT,
  "status" "EmailOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "correlationType" TEXT,
  "correlationId" TEXT,
  "expiresAt" TIMESTAMP(3),
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "lastAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "providerMessageId" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailOutbox_recipient_check" CHECK (length(trim("recipient")) BETWEEN 3 AND 320),
  CONSTRAINT "EmailOutbox_subject_check" CHECK (length(trim("subject")) BETWEEN 1 AND 300),
  CONSTRAINT "EmailOutbox_attempts_check" CHECK ("attempts" >= 0 AND "maxAttempts" BETWEEN 1 AND 20 AND "attempts" <= "maxAttempts"),
  CONSTRAINT "EmailOutbox_bodies_check" CHECK ("textBody" IS NOT NULL OR "htmlBody" IS NOT NULL OR "status" IN ('SENT', 'FAILED', 'EXPIRED', 'CANCELLED')),
  CONSTRAINT "EmailOutbox_lock_check" CHECK (("status" = 'PROCESSING' AND "lockedAt" IS NOT NULL AND "lockedBy" IS NOT NULL) OR ("status" <> 'PROCESSING' AND "lockedAt" IS NULL AND "lockedBy" IS NULL)),
  CONSTRAINT "EmailOutbox_sent_check" CHECK (("status" = 'SENT' AND "sentAt" IS NOT NULL) OR ("status" <> 'SENT' AND "sentAt" IS NULL)),
  CONSTRAINT "EmailOutbox_failed_check" CHECK (("status" = 'FAILED' AND "failedAt" IS NOT NULL) OR ("status" <> 'FAILED' AND "failedAt" IS NULL)),
  CONSTRAINT "EmailOutbox_correlation_check" CHECK (("correlationType" IS NULL) = ("correlationId" IS NULL)),
  CONSTRAINT "EmailOutbox_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EmailOutbox_idempotencyKey_key" ON "EmailOutbox"("idempotencyKey");
CREATE INDEX "EmailOutbox_status_availableAt_createdAt_idx" ON "EmailOutbox"("status", "availableAt", "createdAt");
CREATE INDEX "EmailOutbox_tenantId_createdAt_idx" ON "EmailOutbox"("tenantId", "createdAt");
CREATE INDEX "EmailOutbox_correlationType_correlationId_idx" ON "EmailOutbox"("correlationType", "correlationId");
