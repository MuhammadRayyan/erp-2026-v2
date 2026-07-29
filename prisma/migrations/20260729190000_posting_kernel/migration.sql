CREATE TYPE "JournalEntryStatus" AS ENUM ('PENDING', 'POSTED');
CREATE TYPE "JournalEntryOrigin" AS ENUM ('SYSTEM', 'MANUAL', 'REVERSAL');

CREATE TABLE "JournalEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "postingDate" DATE NOT NULL,
  "currencyCode" VARCHAR(3) NOT NULL,
  "status" "JournalEntryStatus" NOT NULL DEFAULT 'PENDING',
  "origin" "JournalEntryOrigin" NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" VARCHAR(64) NOT NULL,
  "memo" TEXT,
  "reversalOfId" TEXT,
  "postedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalEntry_currency_check" CHECK ("currencyCode" ~ '^[A-Z]{3}$'),
  CONSTRAINT "JournalEntry_source_type_check" CHECK (char_length(btrim("sourceType")) BETWEEN 1 AND 80),
  CONSTRAINT "JournalEntry_source_id_check" CHECK (char_length(btrim("sourceId")) BETWEEN 1 AND 160),
  CONSTRAINT "JournalEntry_idempotency_check" CHECK (char_length(btrim("idempotencyKey")) BETWEEN 8 AND 160),
  CONSTRAINT "JournalEntry_payload_hash_check" CHECK ("payloadHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "JournalEntry_memo_check" CHECK ("memo" IS NULL OR char_length(btrim("memo")) BETWEEN 1 AND 500),
  CONSTRAINT "JournalEntry_origin_reversal_check" CHECK (
    ("origin" = 'REVERSAL' AND "reversalOfId" IS NOT NULL) OR
    ("origin" <> 'REVERSAL' AND "reversalOfId" IS NULL)
  ),
  CONSTRAINT "JournalEntry_status_metadata_check" CHECK (
    ("status" = 'PENDING' AND "postedAt" IS NULL) OR
    ("status" = 'POSTED' AND "postedAt" IS NOT NULL)
  )
);

CREATE TABLE "JournalLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "journalEntryId" TEXT NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  "accountId" TEXT NOT NULL,
  "description" TEXT,
  "debit" DECIMAL(20,4) NOT NULL DEFAULT 0,
  "credit" DECIMAL(20,4) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalLine_number_check" CHECK ("lineNumber" > 0),
  CONSTRAINT "JournalLine_description_check" CHECK ("description" IS NULL OR char_length(btrim("description")) BETWEEN 1 AND 300),
  CONSTRAINT "JournalLine_amount_check" CHECK (
    ("debit" > 0 AND "credit" = 0) OR
    ("credit" > 0 AND "debit" = 0)
  )
);

ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_scope_id_key"
  UNIQUE ("tenantId", "businessId", "id");
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_source_key"
  UNIQUE ("tenantId", "businessId", "sourceType", "sourceId");
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_idempotency_key"
  UNIQUE ("tenantId", "businessId", "idempotencyKey");
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversal_key"
  UNIQUE ("tenantId", "businessId", "reversalOfId");
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_scope_id_key"
  UNIQUE ("tenantId", "businessId", "id");
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_number_key"
  UNIQUE ("tenantId", "businessId", "journalEntryId", "lineNumber");

ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_business_scope_fkey"
  FOREIGN KEY ("tenantId", "businessId") REFERENCES "Business"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_creator_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversal_scope_fkey"
  FOREIGN KEY ("tenantId", "businessId", "reversalOfId") REFERENCES "JournalEntry"("tenantId", "businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entry_scope_fkey"
  FOREIGN KEY ("tenantId", "businessId", "journalEntryId") REFERENCES "JournalEntry"("tenantId", "businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_account_scope_fkey"
  FOREIGN KEY ("tenantId", "businessId", "accountId") REFERENCES "LedgerAccount"("tenantId", "businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "JournalEntry_register_idx"
  ON "JournalEntry"("tenantId", "businessId", "postingDate", "id");
CREATE INDEX "JournalEntry_status_idx"
  ON "JournalEntry"("tenantId", "businessId", "status", "postedAt");
CREATE INDEX "JournalLine_account_idx"
  ON "JournalLine"("tenantId", "businessId", "accountId", "journalEntryId");

CREATE OR REPLACE FUNCTION validate_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  line_count INTEGER;
  total_debit NUMERIC(20,4);
  total_credit NUMERIC(20,4);
  expected_currency TEXT;
  period_status "AccountingPeriodStatus";
  invalid_account_count INTEGER;
  original_status "JournalEntryStatus";
  original_origin "JournalEntryOrigin";
  reversal_mismatch_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'POSTED' THEN
      RAISE EXCEPTION 'JOURNAL_ENTRY_IMMUTABLE';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'PENDING' OR NEW."postedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'JOURNAL_ENTRY_INITIAL_STATE_INVALID';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" = 'POSTED' THEN
    RAISE EXCEPTION 'JOURNAL_ENTRY_IMMUTABLE';
  END IF;

  IF NEW."status" <> 'POSTED' OR NEW."postedAt" IS NULL THEN
    RAISE EXCEPTION 'JOURNAL_ENTRY_FINALIZATION_REQUIRED';
  END IF;

  SELECT count(*)::INTEGER, COALESCE(sum("debit"), 0), COALESCE(sum("credit"), 0)
  INTO line_count, total_debit, total_credit
  FROM "JournalLine"
  WHERE "tenantId" = NEW."tenantId"
    AND "businessId" = NEW."businessId"
    AND "journalEntryId" = NEW."id";

  IF line_count < 2 THEN
    RAISE EXCEPTION 'JOURNAL_ENTRY_MINIMUM_LINES';
  END IF;
  IF total_debit <= 0 OR total_debit <> total_credit THEN
    RAISE EXCEPTION 'JOURNAL_ENTRY_UNBALANCED';
  END IF;

  SELECT "baseCurrency" INTO expected_currency
  FROM "Business"
  WHERE "tenantId" = NEW."tenantId" AND "id" = NEW."businessId"
  FOR SHARE;
  IF expected_currency IS NULL OR NEW."currencyCode" <> expected_currency THEN
    RAISE EXCEPTION 'JOURNAL_ENTRY_BASE_CURRENCY_REQUIRED';
  END IF;

  SELECT "status" INTO period_status
  FROM "AccountingPeriod"
  WHERE "tenantId" = NEW."tenantId"
    AND "businessId" = NEW."businessId"
    AND NEW."postingDate" BETWEEN "startDate" AND "endDate"
  FOR SHARE;
  IF period_status IS NULL THEN
    RAISE EXCEPTION 'ACCOUNTING_PERIOD_NOT_FOUND_FOR_DATE';
  ELSIF period_status = 'SOFT_LOCKED' THEN
    RAISE EXCEPTION 'ACCOUNTING_PERIOD_SOFT_LOCKED';
  ELSIF period_status = 'CLOSED' THEN
    RAISE EXCEPTION 'ACCOUNTING_PERIOD_CLOSED';
  END IF;

  SELECT count(*)::INTEGER INTO invalid_account_count
  FROM "JournalLine" line
  LEFT JOIN "LedgerAccount" account
    ON account."tenantId" = line."tenantId"
   AND account."businessId" = line."businessId"
   AND account."id" = line."accountId"
  WHERE line."tenantId" = NEW."tenantId"
    AND line."businessId" = NEW."businessId"
    AND line."journalEntryId" = NEW."id"
    AND (
      account."id" IS NULL OR
      account."status" <> 'ACTIVE' OR
      account."kind" = 'HEADER' OR
      (NEW."origin" = 'MANUAL' AND (account."kind" <> 'POSTING' OR account."manualPostingAllowed" = false))
    );
  IF invalid_account_count > 0 THEN
    RAISE EXCEPTION 'JOURNAL_ENTRY_ACCOUNT_POLICY_VIOLATION';
  END IF;

  IF NEW."origin" = 'REVERSAL' THEN
    SELECT "status", "origin" INTO original_status, original_origin
    FROM "JournalEntry"
    WHERE "tenantId" = NEW."tenantId"
      AND "businessId" = NEW."businessId"
      AND "id" = NEW."reversalOfId"
    FOR SHARE;
    IF original_status IS NULL OR original_status <> 'POSTED' THEN
      RAISE EXCEPTION 'JOURNAL_REVERSAL_ORIGINAL_NOT_POSTED';
    END IF;
    IF original_origin = 'REVERSAL' THEN
      RAISE EXCEPTION 'JOURNAL_REVERSAL_CHAIN_FORBIDDEN';
    END IF;

    SELECT count(*)::INTEGER INTO reversal_mismatch_count
    FROM (
      SELECT COALESCE(original."accountId", reversal."accountId") AS account_id
      FROM (
        SELECT "accountId", sum("debit") AS debit, sum("credit") AS credit
        FROM "JournalLine"
        WHERE "tenantId" = NEW."tenantId" AND "businessId" = NEW."businessId" AND "journalEntryId" = NEW."reversalOfId"
        GROUP BY "accountId"
      ) original
      FULL JOIN (
        SELECT "accountId", sum("debit") AS debit, sum("credit") AS credit
        FROM "JournalLine"
        WHERE "tenantId" = NEW."tenantId" AND "businessId" = NEW."businessId" AND "journalEntryId" = NEW."id"
        GROUP BY "accountId"
      ) reversal USING ("accountId")
      WHERE COALESCE(original.debit, 0) <> COALESCE(reversal.credit, 0)
         OR COALESCE(original.credit, 0) <> COALESCE(reversal.debit, 0)
    ) mismatch;
    IF reversal_mismatch_count > 0 THEN
      RAISE EXCEPTION 'JOURNAL_REVERSAL_LINES_MISMATCH';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "JournalEntry_validate"
BEFORE INSERT OR UPDATE OR DELETE ON "JournalEntry"
FOR EACH ROW EXECUTE FUNCTION validate_journal_entry();

CREATE OR REPLACE FUNCTION validate_journal_line_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status "JournalEntryStatus";
  target_tenant TEXT;
  target_business TEXT;
  target_entry TEXT;
BEGIN
  target_tenant := COALESCE(NEW."tenantId", OLD."tenantId");
  target_business := COALESCE(NEW."businessId", OLD."businessId");
  target_entry := COALESCE(NEW."journalEntryId", OLD."journalEntryId");

  SELECT "status" INTO parent_status
  FROM "JournalEntry"
  WHERE "tenantId" = target_tenant AND "businessId" = target_business AND "id" = target_entry
  FOR SHARE;

  IF parent_status = 'POSTED' THEN
    RAISE EXCEPTION 'JOURNAL_LINE_IMMUTABLE';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "JournalLine_validate_mutation"
BEFORE INSERT OR UPDATE OR DELETE ON "JournalLine"
FOR EACH ROW EXECUTE FUNCTION validate_journal_line_mutation();

CREATE OR REPLACE FUNCTION ensure_journal_entry_finalized()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_status "JournalEntryStatus";
BEGIN
  SELECT "status" INTO current_status FROM "JournalEntry" WHERE "id" = NEW."id";
  IF current_status IS NOT NULL AND current_status <> 'POSTED' THEN
    RAISE EXCEPTION 'JOURNAL_ENTRY_PENDING_COMMIT_FORBIDDEN';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "JournalEntry_finalized"
AFTER INSERT OR UPDATE ON "JournalEntry"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION ensure_journal_entry_finalized();
