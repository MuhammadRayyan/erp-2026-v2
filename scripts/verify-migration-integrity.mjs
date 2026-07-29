import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const actionName = {
  a: "NO ACTION",
  r: "RESTRICT",
  c: "CASCADE",
  n: "SET NULL",
  d: "SET DEFAULT",
};

const requiredCompositeForeignKeys = [
  ["BusinessInvitationGrant_invitation_scope_fkey", "BusinessInvitationGrant", ["tenantId", "invitationId"], "TenantInvitation", ["tenantId", "id"], "CASCADE"],
  ["BusinessInvitationGrant_tenantId_businessId_fkey", "BusinessInvitationGrant", ["tenantId", "businessId"], "Business", ["tenantId", "id"], "CASCADE"],
  ["BusinessMembership_tenantId_businessId_fkey", "BusinessMembership", ["tenantId", "businessId"], "Business", ["tenantId", "id"], "CASCADE"],
  ["BusinessMembership_tenantId_userId_fkey", "BusinessMembership", ["tenantId", "userId"], "TenantMembership", ["tenantId", "userId"], "CASCADE"],
  ["BusinessProfile_tenantId_businessId_fkey", "BusinessProfile", ["tenantId", "businessId"], "Business", ["tenantId", "id"], "CASCADE"],
  ["CatalogImportBatch_business_scope_fkey", "CatalogImportBatch", ["tenantId", "businessId"], "Business", ["tenantId", "id"], "CASCADE"],
  ["CatalogImportRow_batch_scope_fkey", "CatalogImportRow", ["tenantId", "businessId", "batchId"], "CatalogImportBatch", ["tenantId", "businessId", "id"], "CASCADE"],
  ["CatalogImportRow_existing_item_scope_fkey", "CatalogImportRow", ["tenantId", "businessId", "existingItemId"], "CatalogItem", ["tenantId", "businessId", "id"], "RESTRICT"],
  ["CatalogItem_business_fkey", "CatalogItem", ["tenantId", "businessId"], "Business", ["tenantId", "id"], "CASCADE"],
  ["CatalogItem_unit_fkey", "CatalogItem", ["tenantId", "businessId", "unitId"], "UnitOfMeasure", ["tenantId", "businessId", "id"], "RESTRICT"],
  ["CustomFieldDefinition_business_scope_fkey", "CustomFieldDefinition", ["tenantId", "businessId"], "Business", ["tenantId", "id"], "CASCADE"],
  ["CustomFieldValue_definition_scope_fkey", "CustomFieldValue", ["tenantId", "businessId", "definitionId", "entityType", "valueType"], "CustomFieldDefinition", ["tenantId", "businessId", "id", "entityType", "valueType"], "CASCADE"],
  ["ExportRun_business_scope_fkey", "ExportRun", ["tenantId", "businessId"], "Business", ["tenantId", "id"], "CASCADE"],
  ["FileAttachment_file_scope_fkey", "FileAttachment", ["tenantId", "businessId", "fileId"], "StoredFile", ["tenantId", "businessId", "id"], "CASCADE"],
  ["AuditEvent_business_scope_fkey", "AuditEvent", ["tenantId", "businessId"], "Business", ["tenantId", "id"], "CASCADE"],
  ["NumberSequence_business_scope_fkey", "NumberSequence", ["tenantId", "businessId"], "Business", ["tenantId", "id"], "CASCADE"],
  ["NumberAllocation_sequence_scope_fkey", "NumberAllocation", ["tenantId", "businessId", "sequenceId"], "NumberSequence", ["tenantId", "businessId", "id"], "RESTRICT"],
  ["OnboardingOperation_tenantId_businessId_fkey", "OnboardingOperation", ["tenantId", "businessId"], "Business", ["tenantId", "id"], "RESTRICT"],
  ["Party_business_fkey", "Party", ["tenantId", "businessId"], "Business", ["tenantId", "id"], "CASCADE"],
  ["PartyAddress_party_fkey", "PartyAddress", ["tenantId", "businessId", "partyId"], "Party", ["tenantId", "businessId", "id"], "CASCADE"],
  ["PartyContact_party_fkey", "PartyContact", ["tenantId", "businessId", "partyId"], "Party", ["tenantId", "businessId", "id"], "CASCADE"],
  ["PartyDuplicateReview_firstParty_fkey", "PartyDuplicateReview", ["tenantId", "businessId", "firstPartyId"], "Party", ["tenantId", "businessId", "id"], "CASCADE"],
  ["PartyDuplicateReview_secondParty_fkey", "PartyDuplicateReview", ["tenantId", "businessId", "secondPartyId"], "Party", ["tenantId", "businessId", "id"], "CASCADE"],
  ["PartyRole_party_fkey", "PartyRole", ["tenantId", "businessId", "partyId"], "Party", ["tenantId", "businessId", "id"], "CASCADE"],
  ["StoredFile_business_scope_fkey", "StoredFile", ["tenantId", "businessId"], "Business", ["tenantId", "id"], "CASCADE"],
  ["UnitOfMeasure_business_fkey", "UnitOfMeasure", ["tenantId", "businessId"], "Business", ["tenantId", "id"], "CASCADE"],
];

const requiredChecks = {
  BusinessProfile_fiscal_month_check: ["fiscalyearstartmonth", ">= 1", "<= 12"],
  BusinessProfile_registered_vat_check: ["vatregistrationstatus", "registered", "trn", "[0-9]{15}", "vateffectivefrom"],
  CatalogItem_channel_check: ["salesenabled", "purchaseenabled"],
  CatalogItem_purchase_price_nonnegative: ["defaultpurchaseprice", ">= 0"],
  CatalogItem_sales_price_nonnegative: ["defaultsalesprice", ">= 0"],
  CustomFieldDefinition_key_check: ["key", "[a-z][a-z0-9_]"],
  CustomFieldDefinition_label_check: ["char_length", "btrim", ">= 1", "<= 100"],
  CustomFieldDefinition_options_check: ["valuetype", "select", "jsonb_typeof", "jsonb_array_length", "<= 50"],
  CustomFieldDefinition_sort_check: ["sortorder", ">= 0"],
  CustomFieldValue_typed_value_check: ["textvalue", "numbervalue", "datevalue", "booleanvalue", "valuetype"],
  EmailOutbox_attempts_check: ["attempts", "maxattempts", ">= 1", "<= 20"],
  EmailOutbox_bodies_check: ["textbody", "htmlbody", "sent", "failed", "expired", "cancelled"],
  EmailOutbox_correlation_check: ["correlationtype", "correlationid", "is null"],
  EmailOutbox_failed_check: ["failed", "failedat"],
  EmailOutbox_lock_check: ["processing", "lockedat", "lockedby"],
  EmailOutbox_recipient_check: ["recipient", ">= 3", "<= 320"],
  EmailOutbox_sent_check: ["sent", "sentat"],
  EmailOutbox_subject_check: ["subject", ">= 1", "<= 300"],
  ExportRun_rowCount_check: ["rowcount", ">= 0"],
  ExportRun_sha256_check: ["sha256", "[0-9a-f]{64}"],
  NumberAllocation_numeric_check: ["numericvalue", "> 0"],
  NumberAllocation_void_check: ["allocated", "voided", "voidedat", "voidedbyid", "voidreason", ">= 3"],
  NumberSequence_key_check: ["key", "[a-z][a-z0-9_]"],
  NumberSequence_padding_check: ["padding", ">= 1", "<= 12"],
  NumberSequence_values_check: ["startvalue", "nextvalue", "> 0"],
  Party_identity_check: ["organization", "legalname", "individual", "firstname"],
  PartyDuplicateReview_distinct_parties: ["firstpartyid", "secondpartyid", "<"],
  PlanEntitlement_limit_nonnegative: ["limitvalue", ">= 0"],
  PlanEntitlement_value_present: ["enabled", "limitvalue", "unlimited"],
  StoredFile_sha256_check: ["sha256", "[0-9a-f]{64}"],
  StoredFile_size_check: ["sizebytes", "> 0"],
  TenantEntitlementOverride_limit_nonnegative: ["limitvalue", ">= 0"],
  TenantEntitlementOverride_value_present: ["enabled", "limitvalue", "unlimited"],
  UnitOfMeasure_decimal_places_check: ["decimalplaces", ">= 0", "<= 6"],
};

const requiredIndexes = {
  Party_search_text_trgm_idx: ["party", "using gin", "searchtext", "gin_trgm_ops"],
  PartyContact_one_primary_per_party: ["unique", "partycontact", "tenantid", "businessid", "partyid", "where", "isprimary", "true"],
  PartyAddress_one_default_per_type: ["unique", "partyaddress", "tenantid", "businessid", "partyid", "type", "where", "isdefault", "true"],
};

function normalize(value) {
  return String(value).toLowerCase().replaceAll('"', "").replace(/\s+/g, " ").trim();
}

function equalArrays(first, second) {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function addFailure(failures, label, detail) {
  failures.push(`${label}: ${detail}`);
}

const client = new Client({ connectionString });
const failures = [];

try {
  await client.connect();

  const foreignKeys = await client.query(`
    SELECT
      c.conname AS name,
      rel.relname AS table_name,
      ref.relname AS referenced_table,
      ARRAY(
        SELECT a.attname
        FROM unnest(c.conkey) WITH ORDINALITY AS key(attnum, position)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = key.attnum
        ORDER BY key.position
      ) AS columns,
      ARRAY(
        SELECT a.attname
        FROM unnest(c.confkey) WITH ORDINALITY AS key(attnum, position)
        JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = key.attnum
        ORDER BY key.position
      ) AS referenced_columns,
      c.confdeltype AS delete_action,
      c.confupdtype AS update_action,
      c.convalidated AS validated
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_class ref ON ref.oid = c.confrelid
    WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
  `);
  const foreignKeyByName = new Map(foreignKeys.rows.map((row) => [row.name, row]));

  for (const [name, table, columns, referencedTable, referencedColumns, deleteAction] of requiredCompositeForeignKeys) {
    const row = foreignKeyByName.get(name);
    if (!row) {
      addFailure(failures, name, "missing composite foreign key");
      continue;
    }
    if (row.table_name !== table) addFailure(failures, name, `table is ${row.table_name}, expected ${table}`);
    if (!equalArrays(row.columns, columns)) addFailure(failures, name, `columns are ${row.columns.join(",")}, expected ${columns.join(",")}`);
    if (row.referenced_table !== referencedTable) addFailure(failures, name, `references ${row.referenced_table}, expected ${referencedTable}`);
    if (!equalArrays(row.referenced_columns, referencedColumns)) addFailure(failures, name, `referenced columns are ${row.referenced_columns.join(",")}, expected ${referencedColumns.join(",")}`);
    if (actionName[row.delete_action] !== deleteAction) addFailure(failures, name, `ON DELETE is ${actionName[row.delete_action]}, expected ${deleteAction}`);
    if (actionName[row.update_action] !== "CASCADE") addFailure(failures, name, `ON UPDATE is ${actionName[row.update_action]}, expected CASCADE`);
    if (!row.validated) addFailure(failures, name, "constraint is not validated");
  }

  const checks = await client.query(`
    SELECT c.conname AS name, pg_get_constraintdef(c.oid, true) AS definition, c.convalidated AS validated
    FROM pg_constraint c
    WHERE c.contype = 'c' AND c.connamespace = 'public'::regnamespace
  `);
  const checkByName = new Map(checks.rows.map((row) => [row.name, row]));
  for (const [name, fragments] of Object.entries(requiredChecks)) {
    const row = checkByName.get(name);
    if (!row) {
      addFailure(failures, name, "missing check constraint");
      continue;
    }
    if (!row.validated) addFailure(failures, name, "check constraint is not validated");
    const definition = normalize(row.definition);
    for (const fragment of fragments) {
      if (!definition.includes(normalize(fragment))) addFailure(failures, name, `definition is missing ${fragment}`);
    }
  }

  const indexes = await client.query(`
    SELECT indexname AS name, indexdef AS definition
    FROM pg_indexes
    WHERE schemaname = 'public'
  `);
  const indexByName = new Map(indexes.rows.map((row) => [row.name, normalize(row.definition)]));
  for (const [name, fragments] of Object.entries(requiredIndexes)) {
    const definition = indexByName.get(name);
    if (!definition) {
      addFailure(failures, name, "missing required index");
      continue;
    }
    for (const fragment of fragments) {
      if (!definition.includes(normalize(fragment))) addFailure(failures, name, `definition is missing ${fragment}`);
    }
  }

  const trigger = await client.query(`
    SELECT
      t.tgname AS name,
      rel.relname AS table_name,
      proc.proname AS function_name,
      t.tgenabled AS enabled,
      pg_get_triggerdef(t.oid, true) AS definition
    FROM pg_trigger t
    JOIN pg_class rel ON rel.oid = t.tgrelid
    JOIN pg_proc proc ON proc.oid = t.tgfoid
    WHERE NOT t.tgisinternal AND t.tgname = 'CustomFieldValue_target_check'
  `);
  const targetTrigger = trigger.rows[0];
  if (!targetTrigger) {
    addFailure(failures, "CustomFieldValue_target_check", "missing trigger");
  } else {
    if (targetTrigger.table_name !== "CustomFieldValue") addFailure(failures, targetTrigger.name, `table is ${targetTrigger.table_name}`);
    if (targetTrigger.function_name !== "validate_custom_field_target") addFailure(failures, targetTrigger.name, `function is ${targetTrigger.function_name}`);
    if (targetTrigger.enabled === "D") addFailure(failures, targetTrigger.name, "trigger is disabled");
    const definition = normalize(targetTrigger.definition);
    for (const fragment of ["before insert or update", "for each row", "validate_custom_field_target"]) {
      if (!definition.includes(fragment)) addFailure(failures, targetTrigger.name, `definition is missing ${fragment}`);
    }
  }

  const functionResult = await client.query(`
    SELECT pg_get_functiondef(p.oid) AS definition, l.lanname AS language
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public'
      AND p.proname = 'validate_custom_field_target'
      AND pg_get_function_identity_arguments(p.oid) = ''
  `);
  const targetFunction = functionResult.rows[0];
  if (!targetFunction) {
    addFailure(failures, "validate_custom_field_target", "missing function");
  } else {
    if (targetFunction.language !== "plpgsql") addFailure(failures, "validate_custom_field_target", `language is ${targetFunction.language}`);
    const definition = normalize(targetFunction.definition);
    for (const fragment of ["party", "catalog_item", "tenantid", "businessid", "custom_field_target_not_found"]) {
      if (!definition.includes(fragment)) addFailure(failures, "validate_custom_field_target", `definition is missing ${fragment}`);
    }
  }

  const extensions = await client.query("SELECT extname AS name FROM pg_extension");
  const extensionNames = new Set(extensions.rows.map((row) => row.name));
  if (!extensionNames.has("pg_trgm")) addFailure(failures, "pg_trgm", "required extension is missing");

  if (failures.length > 0) {
    console.error("Migration integrity verification failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`Migration integrity verified: ${requiredCompositeForeignKeys.length} composite foreign keys, ${Object.keys(requiredChecks).length} checks, ${Object.keys(requiredIndexes).length} custom indexes, one trigger/function pair, and pg_trgm.`);
  }
} finally {
  await client.end();
}
