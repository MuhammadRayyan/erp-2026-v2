CREATE TYPE "PartyType" AS ENUM ('ORGANIZATION', 'INDIVIDUAL');
CREATE TYPE "PartyStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "PartyRoleKey" AS ENUM ('CUSTOMER', 'SUPPLIER');
CREATE TYPE "PartyAddressType" AS ENUM ('BILLING', 'DELIVERY', 'SITE', 'OTHER');

CREATE TABLE "Party" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "type" "PartyType" NOT NULL,
  "status" "PartyStatus" NOT NULL DEFAULT 'ACTIVE',
  "displayName" TEXT NOT NULL,
  "legalName" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "taxRegistrationNumber" TEXT,
  "notes" TEXT,
  "searchText" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Party_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Party_identity_check" CHECK (
    ("type" = 'ORGANIZATION' AND "legalName" IS NOT NULL) OR
    ("type" = 'INDIVIDUAL' AND "firstName" IS NOT NULL)
  )
);

CREATE TABLE "PartyRole" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "partyId" TEXT NOT NULL,
  "role" "PartyRoleKey" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartyRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartyContact" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "partyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "jobTitle" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartyContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartyAddress" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "partyId" TEXT NOT NULL,
  "type" "PartyAddressType" NOT NULL,
  "label" TEXT,
  "line1" TEXT NOT NULL,
  "line2" TEXT,
  "city" TEXT,
  "emirate" TEXT,
  "postalCode" TEXT,
  "countryCode" TEXT NOT NULL DEFAULT 'AE',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartyAddress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Party_tenantId_businessId_id_key" ON "Party"("tenantId", "businessId", "id");
CREATE INDEX "Party_tenantId_businessId_status_displayName_idx" ON "Party"("tenantId", "businessId", "status", "displayName");
CREATE INDEX "Party_tenantId_businessId_taxRegistrationNumber_idx" ON "Party"("tenantId", "businessId", "taxRegistrationNumber");
CREATE UNIQUE INDEX "PartyRole_partyId_role_key" ON "PartyRole"("partyId", "role");
CREATE INDEX "PartyRole_tenantId_businessId_role_idx" ON "PartyRole"("tenantId", "businessId", "role");
CREATE INDEX "PartyContact_tenantId_businessId_partyId_idx" ON "PartyContact"("tenantId", "businessId", "partyId");
CREATE INDEX "PartyContact_tenantId_businessId_email_idx" ON "PartyContact"("tenantId", "businessId", "email");
CREATE INDEX "PartyAddress_tenantId_businessId_partyId_type_idx" ON "PartyAddress"("tenantId", "businessId", "partyId", "type");

ALTER TABLE "Party" ADD CONSTRAINT "Party_business_fkey" FOREIGN KEY ("tenantId", "businessId") REFERENCES "Business"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartyRole" ADD CONSTRAINT "PartyRole_party_fkey" FOREIGN KEY ("tenantId", "businessId", "partyId") REFERENCES "Party"("tenantId", "businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartyContact" ADD CONSTRAINT "PartyContact_party_fkey" FOREIGN KEY ("tenantId", "businessId", "partyId") REFERENCES "Party"("tenantId", "businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartyAddress" ADD CONSTRAINT "PartyAddress_party_fkey" FOREIGN KEY ("tenantId", "businessId", "partyId") REFERENCES "Party"("tenantId", "businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
