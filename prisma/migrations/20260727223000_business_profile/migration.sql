CREATE TYPE "IndustryProfileKey" AS ENUM ('GENERAL_SERVICES', 'TECHNICAL_SERVICES', 'AUTOMOTIVE_WORKSHOP', 'CIVIL_ARCHITECTURAL', 'GENERAL_TRADING');
CREATE TYPE "VatRegistrationStatus" AS ENUM ('NOT_REGISTERED', 'REGISTERED', 'DEREGISTERED');
CREATE TYPE "DocumentLanguage" AS ENUM ('ENGLISH', 'ARABIC', 'BILINGUAL');

CREATE TABLE "BusinessProfile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "industryProfile" "IndustryProfileKey",
  "legalForm" TEXT,
  "tradeLicenseNumber" TEXT,
  "tradeLicenseAuthority" TEXT,
  "vatRegistrationStatus" "VatRegistrationStatus" NOT NULL DEFAULT 'NOT_REGISTERED',
  "trn" TEXT,
  "vatEffectiveFrom" TIMESTAMP(3),
  "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
  "documentLanguage" "DocumentLanguage" NOT NULL DEFAULT 'ENGLISH',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BusinessProfile_fiscal_month_check" CHECK ("fiscalYearStartMonth" BETWEEN 1 AND 12),
  CONSTRAINT "BusinessProfile_registered_vat_check" CHECK (
    "vatRegistrationStatus" <> 'REGISTERED'
    OR ("trn" IS NOT NULL AND "trn" ~ '^[0-9]{15}$' AND "vatEffectiveFrom" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "BusinessProfile_businessId_key" ON "BusinessProfile"("businessId");
CREATE UNIQUE INDEX "BusinessProfile_tenantId_businessId_key" ON "BusinessProfile"("tenantId", "businessId");
CREATE INDEX "BusinessProfile_tenantId_industryProfile_idx" ON "BusinessProfile"("tenantId", "industryProfile");
CREATE INDEX "BusinessProfile_tenantId_vatRegistrationStatus_idx" ON "BusinessProfile"("tenantId", "vatRegistrationStatus");

ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_tenantId_businessId_fkey"
FOREIGN KEY ("tenantId", "businessId") REFERENCES "Business"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "BusinessProfile" (
  "id", "tenantId", "businessId", "vatRegistrationStatus", "fiscalYearStartMonth", "documentLanguage", "updatedAt"
)
SELECT 'profile-' || "id", "tenantId", "id", 'NOT_REGISTERED', 1, 'ENGLISH', CURRENT_TIMESTAMP
FROM "Business";
