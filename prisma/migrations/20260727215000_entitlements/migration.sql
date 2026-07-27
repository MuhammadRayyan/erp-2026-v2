CREATE TYPE "EntitlementValueType" AS ENUM ('BOOLEAN', 'LIMIT');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELED');

CREATE TABLE "FeatureDefinition" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "valueType" "EntitlementValueType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeatureDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Plan" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isInternal" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanEntitlement" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "featureId" TEXT NOT NULL,
  "enabled" BOOLEAN,
  "limitValue" INTEGER,
  "unlimited" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanEntitlement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlanEntitlement_limit_nonnegative" CHECK ("limitValue" IS NULL OR "limitValue" >= 0),
  CONSTRAINT "PlanEntitlement_value_present" CHECK ("enabled" IS NOT NULL OR "limitValue" IS NOT NULL OR "unlimited" = true)
);

CREATE TABLE "TenantSubscription" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantEntitlementOverride" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "featureId" TEXT NOT NULL,
  "enabled" BOOLEAN,
  "limitValue" INTEGER,
  "unlimited" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantEntitlementOverride_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantEntitlementOverride_limit_nonnegative" CHECK ("limitValue" IS NULL OR "limitValue" >= 0),
  CONSTRAINT "TenantEntitlementOverride_value_present" CHECK ("enabled" IS NOT NULL OR "limitValue" IS NOT NULL OR "unlimited" = true)
);

CREATE UNIQUE INDEX "FeatureDefinition_key_key" ON "FeatureDefinition"("key");
CREATE UNIQUE INDEX "Plan_key_key" ON "Plan"("key");
CREATE UNIQUE INDEX "PlanEntitlement_planId_featureId_key" ON "PlanEntitlement"("planId", "featureId");
CREATE INDEX "PlanEntitlement_featureId_idx" ON "PlanEntitlement"("featureId");
CREATE UNIQUE INDEX "TenantSubscription_tenantId_key" ON "TenantSubscription"("tenantId");
CREATE INDEX "TenantSubscription_planId_status_idx" ON "TenantSubscription"("planId", "status");
CREATE UNIQUE INDEX "TenantEntitlementOverride_tenantId_featureId_key" ON "TenantEntitlementOverride"("tenantId", "featureId");
CREATE INDEX "TenantEntitlementOverride_featureId_idx" ON "TenantEntitlementOverride"("featureId");

ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "FeatureDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantEntitlementOverride" ADD CONSTRAINT "TenantEntitlementOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantEntitlementOverride" ADD CONSTRAINT "TenantEntitlementOverride_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "FeatureDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "FeatureDefinition" ("id", "key", "name", "description", "valueType", "updatedAt") VALUES
('core.dashboard', 'core.dashboard', 'Dashboard', 'Business dashboard and work queues', 'BOOLEAN', CURRENT_TIMESTAMP),
('core.settings', 'core.settings', 'Business settings', 'Business identity and configuration', 'BOOLEAN', CURRENT_TIMESTAMP),
('users.manage', 'users.manage', 'User management', 'Tenant invitations and member access', 'BOOLEAN', CURRENT_TIMESTAMP),
('sales.core', 'sales.core', 'Sales', 'Quote-to-cash workflows', 'BOOLEAN', CURRENT_TIMESTAMP),
('purchases.core', 'purchases.core', 'Purchases', 'Procure-to-pay workflows', 'BOOLEAN', CURRENT_TIMESTAMP),
('banking.core', 'banking.core', 'Banking', 'Cash and reconciliation workflows', 'BOOLEAN', CURRENT_TIMESTAMP),
('accounting.core', 'accounting.core', 'Accounting', 'Ledger, periods, VAT, and reports', 'BOOLEAN', CURRENT_TIMESTAMP),
('inventory.core', 'inventory.core', 'Inventory', 'Stock and valuation workflows', 'BOOLEAN', CURRENT_TIMESTAMP),
('projects.core', 'projects.core', 'Projects and jobs', 'Project, job, and service operations', 'BOOLEAN', CURRENT_TIMESTAMP),
('reports.core', 'reports.core', 'Reports', 'Financial and operational reports', 'BOOLEAN', CURRENT_TIMESTAMP),
('limit.businesses', 'limit.businesses', 'Business limit', 'Maximum active businesses per tenant', 'LIMIT', CURRENT_TIMESTAMP),
('limit.users', 'limit.users', 'User limit', 'Maximum active and pending tenant users', 'LIMIT', CURRENT_TIMESTAMP);

INSERT INTO "Plan" ("id", "key", "name", "description", "isInternal", "active", "updatedAt") VALUES
('internal-unlimited', 'internal-unlimited', 'Internal Unlimited', 'Owner-operated development and private deployment plan', true, true, CURRENT_TIMESTAMP);

INSERT INTO "PlanEntitlement" ("id", "planId", "featureId", "enabled", "limitValue", "unlimited", "updatedAt")
SELECT 'internal-' || "key", 'internal-unlimited', "id",
  CASE WHEN "valueType" = 'BOOLEAN' THEN true ELSE NULL END,
  NULL,
  CASE WHEN "valueType" = 'LIMIT' THEN true ELSE false END,
  CURRENT_TIMESTAMP
FROM "FeatureDefinition";

INSERT INTO "TenantSubscription" ("id", "tenantId", "planId", "status", "updatedAt")
SELECT 'internal-' || "id", "id", 'internal-unlimited', 'ACTIVE', CURRENT_TIMESTAMP FROM "Tenant";
