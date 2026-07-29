import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

function normalize(value) {
  return String(value).toLowerCase().replaceAll('"', "").replace(/\s+/g, " ").trim();
}

const failures = [];
function requireFragments(label, definition, fragments) {
  if (!definition) {
    failures.push(`${label}: missing`);
    return;
  }
  const normalized = normalize(definition);
  for (const fragment of fragments) {
    if (!normalized.includes(normalize(fragment))) failures.push(`${label}: missing ${fragment}`);
  }
}

const client = new Client({ connectionString });
try {
  await client.connect();

  const constraints = await client.query(`
    SELECT c.conname AS name, c.contype AS type, c.convalidated AS validated,
      pg_get_constraintdef(c.oid, true) AS definition
    FROM pg_constraint c
    WHERE c.connamespace = 'public'::regnamespace
      AND c.conname = ANY($1::text[])
  `, [[
    "JournalEntry_business_scope_fkey",
    "JournalEntry_creator_fkey",
    "JournalEntry_reversal_scope_fkey",
    "JournalLine_entry_scope_fkey",
    "JournalLine_account_scope_fkey",
    "JournalEntry_currency_check",
    "JournalEntry_source_type_check",
    "JournalEntry_source_id_check",
    "JournalEntry_idempotency_check",
    "JournalEntry_payload_hash_check",
    "JournalEntry_memo_check",
    "JournalEntry_origin_reversal_check",
    "JournalEntry_status_metadata_check",
    "JournalLine_number_check",
    "JournalLine_description_check",
    "JournalLine_amount_check",
  ]]);
  const byName = new Map(constraints.rows.map((row) => [row.name, row]));

  const requiredConstraints = {
    JournalEntry_business_scope_fkey: ["foreign key", "tenantid", "businessid", "business", "on delete restrict"],
    JournalEntry_creator_fkey: ["foreign key", "createdbyid", "user", "on delete restrict"],
    JournalEntry_reversal_scope_fkey: ["foreign key", "tenantid", "businessid", "reversalofid", "journalentry", "on delete restrict"],
    JournalLine_entry_scope_fkey: ["foreign key", "tenantid", "businessid", "journalentryid", "journalentry", "on delete cascade"],
    JournalLine_account_scope_fkey: ["foreign key", "tenantid", "businessid", "accountid", "ledgeraccount", "on delete restrict"],
    JournalEntry_currency_check: ["currencycode", "[a-z]{3}"],
    JournalEntry_source_type_check: ["sourcetype", "char_length", "between 1 and 80"],
    JournalEntry_source_id_check: ["sourceid", "char_length", "between 1 and 160"],
    JournalEntry_idempotency_check: ["idempotencykey", "between 8 and 160"],
    JournalEntry_payload_hash_check: ["payloadhash", "[0-9a-f]{64}"],
    JournalEntry_memo_check: ["memo", "between 1 and 500"],
    JournalEntry_origin_reversal_check: ["origin", "reversal", "reversalofid"],
    JournalEntry_status_metadata_check: ["pending", "posted", "postedat"],
    JournalLine_number_check: ["linenumber", "> 0"],
    JournalLine_description_check: ["description", "between 1 and 300"],
    JournalLine_amount_check: ["debit", "credit", "> 0", "= 0"],
  };
  for (const [name, fragments] of Object.entries(requiredConstraints)) {
    const row = byName.get(name);
    if (!row) {
      failures.push(`${name}: missing`);
      continue;
    }
    if (!row.validated) failures.push(`${name}: not validated`);
    requireFragments(name, row.definition, fragments);
  }

  const indexes = await client.query(`SELECT indexname AS name, indexdef AS definition FROM pg_indexes WHERE schemaname = 'public'`);
  const indexByName = new Map(indexes.rows.map((row) => [row.name, row.definition]));
  const requiredIndexes = {
    JournalEntry_source_key: ["unique", "tenantid", "businessid", "sourcetype", "sourceid"],
    JournalEntry_idempotency_key: ["unique", "tenantid", "businessid", "idempotencykey"],
    JournalEntry_reversal_key: ["unique", "tenantid", "businessid", "reversalofid"],
    JournalLine_number_key: ["unique", "tenantid", "businessid", "journalentryid", "linenumber"],
    JournalEntry_register_idx: ["tenantid", "businessid", "postingdate"],
    JournalLine_account_idx: ["tenantid", "businessid", "accountid", "journalentryid"],
  };
  for (const [name, fragments] of Object.entries(requiredIndexes)) requireFragments(name, indexByName.get(name), fragments);

  const functions = await client.query(`
    SELECT p.proname AS name, pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])
  `, [["validate_journal_entry", "validate_journal_line_mutation", "ensure_journal_entry_finalized"]]);
  const functionByName = new Map(functions.rows.map((row) => [row.name, row.definition]));
  requireFragments("validate_journal_entry", functionByName.get("validate_journal_entry"), [
    "journal_entry_unbalanced",
    "accounting_period_closed",
    "journal_entry_account_policy_violation",
    "journal_reversal_lines_mismatch",
    "journal_entry_immutable",
  ]);
  requireFragments("validate_journal_line_mutation", functionByName.get("validate_journal_line_mutation"), ["journal_line_immutable", "for share"]);
  requireFragments("ensure_journal_entry_finalized", functionByName.get("ensure_journal_entry_finalized"), ["journal_entry_pending_commit_forbidden"]);

  const triggers = await client.query(`
    SELECT t.tgname AS name, pg_get_triggerdef(t.oid, true) AS definition,
      t.tgdeferrable AS deferrable, t.tginitdeferred AS initially_deferred
    FROM pg_trigger t
    WHERE NOT t.tgisinternal AND t.tgname = ANY($1::text[])
  `, [["JournalEntry_validate", "JournalLine_validate_mutation", "JournalEntry_finalized"]]);
  const triggerByName = new Map(triggers.rows.map((row) => [row.name, row]));
  requireFragments("JournalEntry_validate", triggerByName.get("JournalEntry_validate")?.definition, ["before insert or delete or update", "journalentry", "validate_journal_entry"]);
  requireFragments("JournalLine_validate_mutation", triggerByName.get("JournalLine_validate_mutation")?.definition, ["before insert or delete or update", "journalline", "validate_journal_line_mutation"]);
  const finalized = triggerByName.get("JournalEntry_finalized");
  requireFragments("JournalEntry_finalized", finalized?.definition, ["constraint trigger", "after insert or update", "ensure_journal_entry_finalized"]);
  if (!finalized?.deferrable || !finalized?.initially_deferred) failures.push("JournalEntry_finalized: must be deferrable and initially deferred");

  if (failures.length) {
    console.error("Journal migration integrity verification failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log("Journal migration integrity verified: scoped keys, amount checks, balance/period/account/reversal validation, immutability, and deferred finalization are present.");
  }
} finally {
  await client.end();
}
