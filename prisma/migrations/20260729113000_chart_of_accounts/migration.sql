CREATE TYPE "AccountClass" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TYPE "AccountNormalBalance" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "AccountKind" AS ENUM ('HEADER', 'POSTING', 'CONTROL');
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "AccountType" AS ENUM (
  'GENERAL', 'CASH', 'BANK', 'ACCOUNTS_RECEIVABLE', 'INVENTORY', 'PREPAYMENT', 'VAT_INPUT',
  'OTHER_CURRENT_ASSET', 'FIXED_ASSET', 'ACCUMULATED_DEPRECIATION', 'ACCOUNTS_PAYABLE',
  'VAT_OUTPUT', 'ACCRUED_EXPENSE', 'OTHER_CURRENT_LIABILITY', 'LONG_TERM_LIABILITY',
  'OWNER_EQUITY', 'RETAINED_EARNINGS', 'SALES_REVENUE', 'SERVICE_REVENUE', 'OTHER_INCOME',
  'COST_OF_GOODS_SOLD', 'DIRECT_COST', 'OPERATING_EXPENSE', 'DEPRECIATION_EXPENSE', 'OTHER_EXPENSE'
);

CREATE TABLE "LedgerAccount" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "class" "AccountClass" NOT NULL,
  "type" "AccountType" NOT NULL,
  "normalBalance" "AccountNormalBalance" NOT NULL,
  "kind" "AccountKind" NOT NULL,
  "isContra" BOOLEAN NOT NULL DEFAULT false,
  "manualPostingAllowed" BOOLEAN NOT NULL DEFAULT true,
  "systemKey" TEXT,
  "systemManaged" BOOLEAN NOT NULL DEFAULT false,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "parentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LedgerAccount_code_check" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9.-]{0,19}$'),
  CONSTRAINT "LedgerAccount_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 160),
  CONSTRAINT "LedgerAccount_system_key_check" CHECK ("systemKey" IS NULL OR "systemKey" ~ '^[A-Z][A-Z0-9_]{0,79}$'),
  CONSTRAINT "LedgerAccount_system_managed_check" CHECK (NOT "systemManaged" OR "systemKey" IS NOT NULL),
  CONSTRAINT "LedgerAccount_required_check" CHECK (NOT "required" OR ("systemManaged" AND "systemKey" IS NOT NULL AND "status" = 'ACTIVE')),
  CONSTRAINT "LedgerAccount_kind_check" CHECK (
    ("kind" = 'HEADER' AND "type" = 'GENERAL' AND NOT "manualPostingAllowed") OR
    ("kind" = 'CONTROL' AND NOT "manualPostingAllowed") OR
    "kind" = 'POSTING'
  ),
  CONSTRAINT "LedgerAccount_balance_check" CHECK (
    ("class" IN ('ASSET', 'EXPENSE') AND ((NOT "isContra" AND "normalBalance" = 'DEBIT') OR ("isContra" AND "normalBalance" = 'CREDIT'))) OR
    ("class" IN ('LIABILITY', 'EQUITY', 'REVENUE') AND ((NOT "isContra" AND "normalBalance" = 'CREDIT') OR ("isContra" AND "normalBalance" = 'DEBIT')))
  ),
  CONSTRAINT "LedgerAccount_type_class_check" CHECK (
    "type" = 'GENERAL' OR
    ("class" = 'ASSET' AND "type" IN ('CASH', 'BANK', 'ACCOUNTS_RECEIVABLE', 'INVENTORY', 'PREPAYMENT', 'VAT_INPUT', 'OTHER_CURRENT_ASSET', 'FIXED_ASSET', 'ACCUMULATED_DEPRECIATION')) OR
    ("class" = 'LIABILITY' AND "type" IN ('ACCOUNTS_PAYABLE', 'VAT_OUTPUT', 'ACCRUED_EXPENSE', 'OTHER_CURRENT_LIABILITY', 'LONG_TERM_LIABILITY')) OR
    ("class" = 'EQUITY' AND "type" IN ('OWNER_EQUITY', 'RETAINED_EARNINGS')) OR
    ("class" = 'REVENUE' AND "type" IN ('SALES_REVENUE', 'SERVICE_REVENUE', 'OTHER_INCOME')) OR
    ("class" = 'EXPENSE' AND "type" IN ('COST_OF_GOODS_SOLD', 'DIRECT_COST', 'OPERATING_EXPENSE', 'DEPRECIATION_EXPENSE', 'OTHER_EXPENSE'))
  )
);

ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_scope_id_key" UNIQUE ("tenantId", "businessId", "id");
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_scope_code_key" UNIQUE ("tenantId", "businessId", "code");
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_scope_system_key" UNIQUE ("tenantId", "businessId", "systemKey");
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_business_scope_fkey"
  FOREIGN KEY ("tenantId", "businessId") REFERENCES "Business"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_parent_scope_fkey"
  FOREIGN KEY ("tenantId", "businessId", "parentId") REFERENCES "LedgerAccount"("tenantId", "businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "LedgerAccount_register_idx" ON "LedgerAccount"("tenantId", "businessId", "class", "status", "code");
CREATE INDEX "LedgerAccount_parent_status_idx" ON "LedgerAccount"("tenantId", "businessId", "parentId", "status");

CREATE OR REPLACE FUNCTION validate_ledger_account_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_class "AccountClass";
  parent_kind "AccountKind";
  parent_status "AccountStatus";
  creates_cycle BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."systemKey" IS NOT NULL AND NEW."systemKey" IS DISTINCT FROM OLD."systemKey" THEN
      RAISE EXCEPTION 'LEDGER_ACCOUNT_SYSTEM_KEY_IMMUTABLE';
    END IF;

    IF OLD."systemManaged" AND (
      NEW."class" IS DISTINCT FROM OLD."class" OR
      NEW."type" IS DISTINCT FROM OLD."type" OR
      NEW."normalBalance" IS DISTINCT FROM OLD."normalBalance" OR
      NEW."kind" IS DISTINCT FROM OLD."kind" OR
      NEW."isContra" IS DISTINCT FROM OLD."isContra" OR
      NEW."manualPostingAllowed" IS DISTINCT FROM OLD."manualPostingAllowed" OR
      NEW."parentId" IS DISTINCT FROM OLD."parentId" OR
      NEW."required" IS DISTINCT FROM OLD."required" OR
      NEW."systemManaged" IS DISTINCT FROM OLD."systemManaged"
    ) THEN
      RAISE EXCEPTION 'LEDGER_ACCOUNT_SYSTEM_STRUCTURE_IMMUTABLE';
    END IF;

    IF NEW."kind" <> 'HEADER' AND EXISTS (
      SELECT 1 FROM "LedgerAccount" child
      WHERE child."tenantId" = NEW."tenantId" AND child."businessId" = NEW."businessId" AND child."parentId" = NEW."id"
    ) THEN
      RAISE EXCEPTION 'LEDGER_ACCOUNT_HAS_CHILDREN';
    END IF;

    IF NEW."class" IS DISTINCT FROM OLD."class" AND EXISTS (
      SELECT 1 FROM "LedgerAccount" child
      WHERE child."tenantId" = NEW."tenantId" AND child."businessId" = NEW."businessId" AND child."parentId" = NEW."id"
    ) THEN
      RAISE EXCEPTION 'LEDGER_ACCOUNT_PARENT_CLASS_LOCKED';
    END IF;

    IF NEW."status" = 'INACTIVE' AND EXISTS (
      SELECT 1 FROM "LedgerAccount" child
      WHERE child."tenantId" = NEW."tenantId" AND child."businessId" = NEW."businessId" AND child."parentId" = NEW."id" AND child."status" = 'ACTIVE'
    ) THEN
      RAISE EXCEPTION 'LEDGER_ACCOUNT_ACTIVE_CHILDREN';
    END IF;
  END IF;

  IF NEW."parentId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."parentId" = NEW."id" THEN
    RAISE EXCEPTION 'LEDGER_ACCOUNT_SELF_PARENT';
  END IF;

  SELECT parent."class", parent."kind", parent."status"
  INTO parent_class, parent_kind, parent_status
  FROM "LedgerAccount" parent
  WHERE parent."tenantId" = NEW."tenantId"
    AND parent."businessId" = NEW."businessId"
    AND parent."id" = NEW."parentId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEDGER_ACCOUNT_PARENT_NOT_FOUND';
  END IF;

  IF parent_kind <> 'HEADER' THEN
    RAISE EXCEPTION 'LEDGER_ACCOUNT_PARENT_NOT_HEADER';
  END IF;

  IF parent_class <> NEW."class" THEN
    RAISE EXCEPTION 'LEDGER_ACCOUNT_PARENT_CLASS_MISMATCH';
  END IF;

  IF NEW."status" = 'ACTIVE' AND parent_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'LEDGER_ACCOUNT_PARENT_INACTIVE';
  END IF;

  WITH RECURSIVE ancestors("id", "parentId") AS (
    SELECT parent."id", parent."parentId"
    FROM "LedgerAccount" parent
    WHERE parent."tenantId" = NEW."tenantId" AND parent."businessId" = NEW."businessId" AND parent."id" = NEW."parentId"
    UNION ALL
    SELECT parent."id", parent."parentId"
    FROM "LedgerAccount" parent
    JOIN ancestors current ON current."parentId" = parent."id"
    WHERE parent."tenantId" = NEW."tenantId" AND parent."businessId" = NEW."businessId"
  )
  SELECT EXISTS (SELECT 1 FROM ancestors WHERE "id" = NEW."id") INTO creates_cycle;

  IF creates_cycle THEN
    RAISE EXCEPTION 'LEDGER_ACCOUNT_HIERARCHY_CYCLE';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "LedgerAccount_hierarchy_check"
BEFORE INSERT OR UPDATE ON "LedgerAccount"
FOR EACH ROW EXECUTE FUNCTION validate_ledger_account_hierarchy();

INSERT INTO "FeatureDefinition" ("id", "key", "name", "description", "valueType", "createdAt", "updatedAt")
VALUES ('feature-accounting-core', 'accounting.core', 'Accounting', 'Chart of accounts and accounting kernel', 'BOOLEAN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "valueType" = EXCLUDED."valueType",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanEntitlement" ("id", "planId", "featureId", "enabled", "limitValue", "unlimited", "createdAt", "updatedAt")
SELECT 'pe-accounting-' || md5(plan."id"), plan."id", feature."id", true, NULL, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Plan" plan
JOIN "FeatureDefinition" feature ON feature."key" = 'accounting.core'
WHERE plan."active" = true
ON CONFLICT ("planId", "featureId") DO UPDATE SET
  "enabled" = true,
  "limitValue" = NULL,
  "unlimited" = false,
  "updatedAt" = CURRENT_TIMESTAMP;

CREATE TEMP TABLE "_DefaultLedgerAccount" (
  "systemKey" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "class" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "normalBalance" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "isContra" BOOLEAN NOT NULL,
  "manualPostingAllowed" BOOLEAN NOT NULL,
  "required" BOOLEAN NOT NULL,
  "parentSystemKey" TEXT
) ON COMMIT DROP;

INSERT INTO "_DefaultLedgerAccount" VALUES
('ASSETS','1000','Assets','Asset accounts','ASSET','GENERAL','DEBIT','HEADER',false,false,true,NULL),
('CURRENT_ASSETS','1100','Current Assets','Cash and assets expected to be used or realized within one year','ASSET','GENERAL','DEBIT','HEADER',false,false,true,'ASSETS'),
('CASH_ON_HAND','1110','Cash on Hand','Physical cash and petty cash','ASSET','CASH','DEBIT','POSTING',false,true,false,'CURRENT_ASSETS'),
('BANK_ACCOUNT','1120','Bank Account','Primary operating bank account','ASSET','BANK','DEBIT','POSTING',false,true,false,'CURRENT_ASSETS'),
('ACCOUNTS_RECEIVABLE','1130','Accounts Receivable','Customer balances controlled by receivable subledgers','ASSET','ACCOUNTS_RECEIVABLE','DEBIT','CONTROL',false,false,true,'CURRENT_ASSETS'),
('INVENTORY','1140','Inventory','Inventory value controlled by the stock ledger when enabled','ASSET','INVENTORY','DEBIT','CONTROL',false,false,false,'CURRENT_ASSETS'),
('PREPAYMENTS','1150','Prepayments','Expenses paid before recognition','ASSET','PREPAYMENT','DEBIT','POSTING',false,true,false,'CURRENT_ASSETS'),
('VAT_INPUT','1160','VAT Recoverable','Recoverable input VAT control account','ASSET','VAT_INPUT','DEBIT','CONTROL',false,false,false,'CURRENT_ASSETS'),
('NON_CURRENT_ASSETS','1200','Non-current Assets','Long-term assets','ASSET','GENERAL','DEBIT','HEADER',false,false,true,'ASSETS'),
('PROPERTY_EQUIPMENT','1210','Property and Equipment','Property, plant, equipment, and capitalized assets','ASSET','FIXED_ASSET','DEBIT','POSTING',false,true,false,'NON_CURRENT_ASSETS'),
('ACCUMULATED_DEPRECIATION','1220','Accumulated Depreciation','Contra-asset accumulated depreciation','ASSET','ACCUMULATED_DEPRECIATION','CREDIT','POSTING',true,true,false,'NON_CURRENT_ASSETS'),
('LIABILITIES','2000','Liabilities','Liability accounts','LIABILITY','GENERAL','CREDIT','HEADER',false,false,true,NULL),
('CURRENT_LIABILITIES','2100','Current Liabilities','Obligations expected to settle within one year','LIABILITY','GENERAL','CREDIT','HEADER',false,false,true,'LIABILITIES'),
('ACCOUNTS_PAYABLE','2110','Accounts Payable','Supplier balances controlled by payable subledgers','LIABILITY','ACCOUNTS_PAYABLE','CREDIT','CONTROL',false,false,true,'CURRENT_LIABILITIES'),
('VAT_OUTPUT','2120','VAT Payable','Output VAT control account','LIABILITY','VAT_OUTPUT','CREDIT','CONTROL',false,false,false,'CURRENT_LIABILITIES'),
('ACCRUED_EXPENSES','2130','Accrued Expenses','Expenses incurred but not yet paid','LIABILITY','ACCRUED_EXPENSE','CREDIT','POSTING',false,true,false,'CURRENT_LIABILITIES'),
('NON_CURRENT_LIABILITIES','2200','Non-current Liabilities','Long-term obligations','LIABILITY','GENERAL','CREDIT','HEADER',false,false,true,'LIABILITIES'),
('LOANS_PAYABLE','2210','Loans Payable','Long-term loans and financing obligations','LIABILITY','LONG_TERM_LIABILITY','CREDIT','POSTING',false,true,false,'NON_CURRENT_LIABILITIES'),
('EQUITY','3000','Equity','Owner and accumulated equity','EQUITY','GENERAL','CREDIT','HEADER',false,false,true,NULL),
('OWNER_CAPITAL','3100','Owner Capital','Owner contributions and capital','EQUITY','OWNER_EQUITY','CREDIT','POSTING',false,true,false,'EQUITY'),
('RETAINED_EARNINGS','3200','Retained Earnings','Accumulated earnings controlled by period close','EQUITY','RETAINED_EARNINGS','CREDIT','CONTROL',false,false,true,'EQUITY'),
('REVENUE','4000','Revenue','Operating and other revenue','REVENUE','GENERAL','CREDIT','HEADER',false,false,true,NULL),
('SALES_REVENUE','4100','Sales Revenue','Revenue from product sales','REVENUE','SALES_REVENUE','CREDIT','POSTING',false,true,false,'REVENUE'),
('SERVICE_REVENUE','4200','Service Revenue','Revenue from services','REVENUE','SERVICE_REVENUE','CREDIT','POSTING',false,true,false,'REVENUE'),
('OTHER_INCOME','4300','Other Income','Non-core operating income','REVENUE','OTHER_INCOME','CREDIT','POSTING',false,true,false,'REVENUE'),
('COST_OF_SALES','5000','Cost of Sales','Direct costs associated with revenue','EXPENSE','GENERAL','DEBIT','HEADER',false,false,true,NULL),
('COST_OF_GOODS_SOLD','5100','Cost of Goods Sold','Cost of products sold','EXPENSE','COST_OF_GOODS_SOLD','DEBIT','POSTING',false,true,false,'COST_OF_SALES'),
('DIRECT_COSTS','5200','Direct Costs','Direct service and job costs','EXPENSE','DIRECT_COST','DEBIT','POSTING',false,true,false,'COST_OF_SALES'),
('OPERATING_EXPENSES','6000','Operating Expenses','General operating expenses','EXPENSE','GENERAL','DEBIT','HEADER',false,false,true,NULL),
('SALARIES_WAGES','6100','Salaries and Wages','Employee salaries, wages, and related costs','EXPENSE','OPERATING_EXPENSE','DEBIT','POSTING',false,true,false,'OPERATING_EXPENSES'),
('RENT_EXPENSE','6200','Rent Expense','Office, workshop, and facility rent','EXPENSE','OPERATING_EXPENSE','DEBIT','POSTING',false,true,false,'OPERATING_EXPENSES'),
('UTILITIES_EXPENSE','6300','Utilities Expense','Electricity, water, telecommunications, and utilities','EXPENSE','OPERATING_EXPENSE','DEBIT','POSTING',false,true,false,'OPERATING_EXPENSES'),
('PROFESSIONAL_FEES','6400','Professional Fees','Legal, accounting, consulting, and professional services','EXPENSE','OPERATING_EXPENSE','DEBIT','POSTING',false,true,false,'OPERATING_EXPENSES'),
('VEHICLE_TRAVEL','6500','Vehicle and Travel','Vehicle, fuel, transport, and business travel','EXPENSE','OPERATING_EXPENSE','DEBIT','POSTING',false,true,false,'OPERATING_EXPENSES'),
('DEPRECIATION_EXPENSE','6600','Depreciation Expense','Periodic depreciation expense','EXPENSE','DEPRECIATION_EXPENSE','DEBIT','POSTING',false,true,false,'OPERATING_EXPENSES'),
('GENERAL_ADMIN','6700','General and Administrative','General administrative costs','EXPENSE','OPERATING_EXPENSE','DEBIT','POSTING',false,true,false,'OPERATING_EXPENSES'),
('BANK_CHARGES','6800','Bank Charges','Bank charges and transaction fees','EXPENSE','OPERATING_EXPENSE','DEBIT','POSTING',false,true,false,'OPERATING_EXPENSES'),
('OTHER_EXPENSE','6900','Other Expense','Other operating expenses','EXPENSE','OTHER_EXPENSE','DEBIT','POSTING',false,true,false,'OPERATING_EXPENSES');

INSERT INTO "LedgerAccount" (
  "id", "tenantId", "businessId", "code", "name", "description", "class", "type", "normalBalance", "kind",
  "isContra", "manualPostingAllowed", "systemKey", "systemManaged", "required", "status", "parentId", "createdAt", "updatedAt"
)
SELECT business."id" || ':coa:' || lower(definition."systemKey"), business."tenantId", business."id", definition."code", definition."name", definition."description",
  definition."class"::"AccountClass", definition."type"::"AccountType", definition."normalBalance"::"AccountNormalBalance", definition."kind"::"AccountKind",
  definition."isContra", definition."manualPostingAllowed", definition."systemKey", true, definition."required", 'ACTIVE'::"AccountStatus", NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Business" business CROSS JOIN "_DefaultLedgerAccount" definition
WHERE definition."parentSystemKey" IS NULL
ON CONFLICT ("tenantId", "businessId", "systemKey") DO NOTHING;

INSERT INTO "LedgerAccount" (
  "id", "tenantId", "businessId", "code", "name", "description", "class", "type", "normalBalance", "kind",
  "isContra", "manualPostingAllowed", "systemKey", "systemManaged", "required", "status", "parentId", "createdAt", "updatedAt"
)
SELECT business."id" || ':coa:' || lower(definition."systemKey"), business."tenantId", business."id", definition."code", definition."name", definition."description",
  definition."class"::"AccountClass", definition."type"::"AccountType", definition."normalBalance"::"AccountNormalBalance", definition."kind"::"AccountKind",
  definition."isContra", definition."manualPostingAllowed", definition."systemKey", true, definition."required", 'ACTIVE'::"AccountStatus",
  business."id" || ':coa:' || lower(definition."parentSystemKey"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Business" business CROSS JOIN "_DefaultLedgerAccount" definition
WHERE definition."parentSystemKey" IS NOT NULL AND definition."kind" = 'HEADER'
ON CONFLICT ("tenantId", "businessId", "systemKey") DO NOTHING;

INSERT INTO "LedgerAccount" (
  "id", "tenantId", "businessId", "code", "name", "description", "class", "type", "normalBalance", "kind",
  "isContra", "manualPostingAllowed", "systemKey", "systemManaged", "required", "status", "parentId", "createdAt", "updatedAt"
)
SELECT business."id" || ':coa:' || lower(definition."systemKey"), business."tenantId", business."id", definition."code", definition."name", definition."description",
  definition."class"::"AccountClass", definition."type"::"AccountType", definition."normalBalance"::"AccountNormalBalance", definition."kind"::"AccountKind",
  definition."isContra", definition."manualPostingAllowed", definition."systemKey", true, definition."required", 'ACTIVE'::"AccountStatus",
  business."id" || ':coa:' || lower(definition."parentSystemKey"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Business" business CROSS JOIN "_DefaultLedgerAccount" definition
WHERE definition."kind" <> 'HEADER'
ON CONFLICT ("tenantId", "businessId", "systemKey") DO NOTHING;

DROP TABLE "_DefaultLedgerAccount";