CREATE TYPE "AccountingPeriodStatus" AS ENUM ('OPEN', 'SOFT_LOCKED', 'CLOSED');

CREATE TABLE "AccountingPeriod" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
  "statusReason" TEXT,
  "statusChangedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountingPeriod_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 100),
  CONSTRAINT "AccountingPeriod_dates_check" CHECK ("startDate" <= "endDate"),
  CONSTRAINT "AccountingPeriod_reason_check" CHECK ("statusReason" IS NULL OR char_length(btrim("statusReason")) BETWEEN 3 AND 500),
  CONSTRAINT "AccountingPeriod_status_metadata_check" CHECK (
    "status" = 'OPEN' OR ("statusReason" IS NOT NULL AND "statusChangedAt" IS NOT NULL)
  )
);

ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_scope_id_key"
  UNIQUE ("tenantId", "businessId", "id");
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_scope_dates_key"
  UNIQUE ("tenantId", "businessId", "startDate", "endDate");
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_business_scope_fkey"
  FOREIGN KEY ("tenantId", "businessId") REFERENCES "Business"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "AccountingPeriod_register_idx"
  ON "AccountingPeriod"("tenantId", "businessId", "startDate", "endDate");
CREATE INDEX "AccountingPeriod_status_idx"
  ON "AccountingPeriod"("tenantId", "businessId", "status", "startDate");

CREATE OR REPLACE FUNCTION validate_accounting_period()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  fiscal_start_month INTEGER;
  fiscal_year_start DATE;
  fiscal_year_end DATE;
  fiscal_start_year INTEGER;
  overlaps_existing BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ACCOUNTING_PERIOD_DELETE_FORBIDDEN';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('accounting-period:' || NEW."tenantId" || ':' || NEW."businessId", 0));

  SELECT profile."fiscalYearStartMonth"
  INTO fiscal_start_month
  FROM "BusinessProfile" profile
  WHERE profile."tenantId" = NEW."tenantId" AND profile."businessId" = NEW."businessId";

  IF fiscal_start_month IS NULL THEN
    RAISE EXCEPTION 'ACCOUNTING_PERIOD_PROFILE_REQUIRED';
  END IF;

  fiscal_start_year := EXTRACT(YEAR FROM NEW."startDate")::INTEGER;
  IF EXTRACT(MONTH FROM NEW."startDate")::INTEGER < fiscal_start_month THEN
    fiscal_start_year := fiscal_start_year - 1;
  END IF;
  fiscal_year_start := make_date(fiscal_start_year, fiscal_start_month, 1);
  fiscal_year_end := (fiscal_year_start + INTERVAL '1 year - 1 day')::DATE;

  IF NEW."startDate" < fiscal_year_start OR NEW."endDate" > fiscal_year_end THEN
    RAISE EXCEPTION 'ACCOUNTING_PERIOD_FISCAL_YEAR_BOUNDARY';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM "AccountingPeriod" period
    WHERE period."tenantId" = NEW."tenantId"
      AND period."businessId" = NEW."businessId"
      AND period."id" <> NEW."id"
      AND daterange(period."startDate", period."endDate", '[]') && daterange(NEW."startDate", NEW."endDate", '[]')
  ) INTO overlaps_existing;

  IF overlaps_existing THEN
    RAISE EXCEPTION 'ACCOUNTING_PERIOD_OVERLAP';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'OPEN' OR NEW."statusReason" IS NOT NULL OR NEW."statusChangedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'ACCOUNTING_PERIOD_INITIAL_STATE_INVALID';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" <> 'OPEN' AND (
    NEW."startDate" IS DISTINCT FROM OLD."startDate" OR
    NEW."endDate" IS DISTINCT FROM OLD."endDate"
  ) THEN
    RAISE EXCEPTION 'ACCOUNTING_PERIOD_DATES_LOCKED';
  END IF;

  IF NEW."status" IS DISTINCT FROM OLD."status" THEN
    IF NEW."statusReason" IS NULL OR NEW."statusChangedAt" IS NULL THEN
      RAISE EXCEPTION 'ACCOUNTING_PERIOD_TRANSITION_REASON_REQUIRED';
    END IF;

    IF NOT (
      (OLD."status" = 'OPEN' AND NEW."status" IN ('SOFT_LOCKED', 'CLOSED')) OR
      (OLD."status" = 'SOFT_LOCKED' AND NEW."status" IN ('OPEN', 'CLOSED')) OR
      (OLD."status" = 'CLOSED' AND NEW."status" = 'OPEN')
    ) THEN
      RAISE EXCEPTION 'ACCOUNTING_PERIOD_TRANSITION_INVALID';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "AccountingPeriod_validate"
BEFORE INSERT OR UPDATE OR DELETE ON "AccountingPeriod"
FOR EACH ROW EXECUTE FUNCTION validate_accounting_period();
