import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

function normalize(value) {
  return String(value).toLowerCase().replaceAll('"', "").replace(/\s+/g, " ").trim();
}

function requireFragments(failures, label, value, fragments) {
  const normalized = normalize(value);
  for (const fragment of fragments) {
    if (!normalized.includes(normalize(fragment))) failures.push(`${label}: missing ${fragment}`);
  }
}

const client = new Client({ connectionString });
const failures = [];

try {
  await client.connect();

  const foreignKey = await client.query(`
    SELECT
      c.conname AS name,
      rel.relname AS table_name,
      ref.relname AS referenced_table,
      ARRAY(
        SELECT a.attname::text
        FROM unnest(c.conkey) WITH ORDINALITY AS key(attnum, position)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = key.attnum
        ORDER BY key.position
      ) AS columns,
      ARRAY(
        SELECT a.attname::text
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
    WHERE c.conname = 'AccountingPeriod_business_scope_fkey'
  `);
  const fk = foreignKey.rows[0];
  if (!fk) failures.push("AccountingPeriod_business_scope_fkey: missing");
  else {
    if (fk.table_name !== "AccountingPeriod") failures.push(`AccountingPeriod_business_scope_fkey: table is ${fk.table_name}`);
    if (fk.referenced_table !== "Business") failures.push(`AccountingPeriod_business_scope_fkey: references ${fk.referenced_table}`);
    if (fk.columns.join(",") !== "tenantId,businessId") failures.push(`AccountingPeriod_business_scope_fkey: columns are ${fk.columns.join(",")}`);
    if (fk.referenced_columns.join(",") !== "tenantId,id") failures.push(`AccountingPeriod_business_scope_fkey: referenced columns are ${fk.referenced_columns.join(",")}`);
    if (fk.delete_action !== "c" || fk.update_action !== "c") failures.push("AccountingPeriod_business_scope_fkey: expected cascading update/delete");
    if (!fk.validated) failures.push("AccountingPeriod_business_scope_fkey: not validated");
  }

  const requiredChecks = {
    AccountingPeriod_name_check: ["char_length", "btrim", ">= 1", "<= 100"],
    AccountingPeriod_dates_check: ["startdate", "<=", "enddate"],
    AccountingPeriod_reason_check: ["statusreason", "is null", ">= 3", "<= 500"],
    AccountingPeriod_status_metadata_check: ["status", "open", "statusreason", "statuschangedat"],
  };
  const checks = await client.query(`
    SELECT c.conname AS name, pg_get_constraintdef(c.oid, true) AS definition, c.convalidated AS validated
    FROM pg_constraint c
    WHERE c.contype = 'c' AND c.connamespace = 'public'::regnamespace
      AND c.conname = ANY($1::text[])
  `, [Object.keys(requiredChecks)]);
  const checkByName = new Map(checks.rows.map((row) => [row.name, row]));
  for (const [name, fragments] of Object.entries(requiredChecks)) {
    const row = checkByName.get(name);
    if (!row) failures.push(`${name}: missing`);
    else {
      if (!row.validated) failures.push(`${name}: not validated`);
      requireFragments(failures, name, row.definition, fragments);
    }
  }

  const triggerResult = await client.query(`
    SELECT rel.relname AS table_name, proc.proname AS function_name, t.tgenabled AS enabled,
      pg_get_triggerdef(t.oid, true) AS definition
    FROM pg_trigger t
    JOIN pg_class rel ON rel.oid = t.tgrelid
    JOIN pg_proc proc ON proc.oid = t.tgfoid
    WHERE NOT t.tgisinternal AND t.tgname = 'AccountingPeriod_validate'
  `);
  const trigger = triggerResult.rows[0];
  if (!trigger) failures.push("AccountingPeriod_validate: missing trigger");
  else {
    if (trigger.table_name !== "AccountingPeriod") failures.push(`AccountingPeriod_validate: table is ${trigger.table_name}`);
    if (trigger.function_name !== "validate_accounting_period") failures.push(`AccountingPeriod_validate: function is ${trigger.function_name}`);
    if (trigger.enabled === "D") failures.push("AccountingPeriod_validate: trigger is disabled");
    requireFragments(failures, "AccountingPeriod_validate", trigger.definition, ["before insert or delete or update", "for each row", "validate_accounting_period"]);
  }

  const functionResult = await client.query(`
    SELECT pg_get_functiondef(p.oid) AS definition, l.lanname AS language
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public' AND p.proname = 'validate_accounting_period'
      AND pg_get_function_identity_arguments(p.oid) = ''
  `);
  const fn = functionResult.rows[0];
  if (!fn) failures.push("validate_accounting_period: missing function");
  else {
    if (fn.language !== "plpgsql") failures.push(`validate_accounting_period: language is ${fn.language}`);
    requireFragments(failures, "validate_accounting_period", fn.definition, [
      "accounting_period_delete_forbidden",
      "pg_advisory_xact_lock",
      "accounting_period_fiscal_year_boundary",
      "accounting_period_overlap",
      "accounting_period_dates_locked",
      "accounting_period_transition_invalid",
      "daterange",
    ]);
  }

  if (failures.length > 0) {
    console.error("Accounting-period migration integrity verification failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log("Accounting-period migration integrity verified: composite scope, four checks, and period validation trigger/function.");
  }
} finally {
  await client.end();
}
