CREATE TYPE "CustomFieldEntityType" AS ENUM ('PARTY', 'CATALOG_ITEM');
CREATE TYPE "CustomFieldValueType" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT');

CREATE TABLE "CustomFieldDefinition" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "entityType" "CustomFieldEntityType" NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "valueType" "CustomFieldValueType" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "options" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomFieldDefinition_key_check" CHECK ("key" ~ '^[a-z][a-z0-9_]{1,49}$'),
  CONSTRAINT "CustomFieldDefinition_label_check" CHECK (char_length(btrim("label")) BETWEEN 1 AND 100),
  CONSTRAINT "CustomFieldDefinition_sort_check" CHECK ("sortOrder" >= 0),
  CONSTRAINT "CustomFieldDefinition_options_check" CHECK (
    ("valueType" = 'SELECT' AND jsonb_typeof("options") = 'array' AND jsonb_array_length("options") BETWEEN 1 AND 50)
    OR ("valueType" <> 'SELECT' AND "options" IS NULL)
  )
);

CREATE TABLE "CustomFieldValue" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "entityType" "CustomFieldEntityType" NOT NULL,
  "valueType" "CustomFieldValueType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "textValue" TEXT,
  "numberValue" DECIMAL(19,4),
  "dateValue" DATE,
  "booleanValue" BOOLEAN,
  "updatedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomFieldValue_typed_value_check" CHECK (
    (("valueType" IN ('TEXT', 'LONG_TEXT', 'SELECT')) AND "textValue" IS NOT NULL AND "numberValue" IS NULL AND "dateValue" IS NULL AND "booleanValue" IS NULL)
    OR ("valueType" = 'NUMBER' AND "textValue" IS NULL AND "numberValue" IS NOT NULL AND "dateValue" IS NULL AND "booleanValue" IS NULL)
    OR ("valueType" = 'DATE' AND "textValue" IS NULL AND "numberValue" IS NULL AND "dateValue" IS NOT NULL AND "booleanValue" IS NULL)
    OR ("valueType" = 'BOOLEAN' AND "textValue" IS NULL AND "numberValue" IS NULL AND "dateValue" IS NULL AND "booleanValue" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "CustomFieldDefinition_scope_id_key" ON "CustomFieldDefinition"("tenantId", "businessId", "id");
CREATE UNIQUE INDEX "CustomFieldDefinition_scope_id_type_key" ON "CustomFieldDefinition"("tenantId", "businessId", "id", "entityType", "valueType");
CREATE UNIQUE INDEX "CustomFieldDefinition_scope_entity_key_key" ON "CustomFieldDefinition"("tenantId", "businessId", "entityType", "key");
CREATE INDEX "CustomFieldDefinition_scope_entity_active_order_idx" ON "CustomFieldDefinition"("tenantId", "businessId", "entityType", "active", "sortOrder");
CREATE UNIQUE INDEX "CustomFieldValue_scope_definition_entity_key" ON "CustomFieldValue"("tenantId", "businessId", "definitionId", "entityId");
CREATE INDEX "CustomFieldValue_scope_entity_record_idx" ON "CustomFieldValue"("tenantId", "businessId", "entityType", "entityId");
CREATE INDEX "CustomFieldValue_scope_definition_idx" ON "CustomFieldValue"("tenantId", "businessId", "definitionId");

ALTER TABLE "CustomFieldDefinition"
ADD CONSTRAINT "CustomFieldDefinition_business_scope_fkey"
FOREIGN KEY ("tenantId", "businessId") REFERENCES "Business"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomFieldValue"
ADD CONSTRAINT "CustomFieldValue_definition_scope_fkey"
FOREIGN KEY ("tenantId", "businessId", "definitionId", "entityType", "valueType")
REFERENCES "CustomFieldDefinition"("tenantId", "businessId", "id", "entityType", "valueType") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomFieldValue"
ADD CONSTRAINT "CustomFieldValue_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION validate_custom_field_target() RETURNS trigger AS $$
BEGIN
  IF NEW."entityType" = 'PARTY' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "Party"
      WHERE "id" = NEW."entityId" AND "tenantId" = NEW."tenantId" AND "businessId" = NEW."businessId"
    ) THEN RAISE EXCEPTION 'CUSTOM_FIELD_TARGET_NOT_FOUND'; END IF;
  ELSIF NEW."entityType" = 'CATALOG_ITEM' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "CatalogItem"
      WHERE "id" = NEW."entityId" AND "tenantId" = NEW."tenantId" AND "businessId" = NEW."businessId"
    ) THEN RAISE EXCEPTION 'CUSTOM_FIELD_TARGET_NOT_FOUND'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CustomFieldValue_target_check"
BEFORE INSERT OR UPDATE OF "tenantId", "businessId", "entityType", "entityId"
ON "CustomFieldValue"
FOR EACH ROW EXECUTE FUNCTION validate_custom_field_target();
