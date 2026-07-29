import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const client = new Client({ connectionString });

function section(title, rows) {
  console.log(`\n=== ${title} (${rows.length}) ===`);
  for (const row of rows) console.log(JSON.stringify(row));
}

try {
  await client.connect();

  const foreignKeys = await client.query(`
    SELECT
      c.conname AS name,
      c.conrelid::regclass::text AS table_name,
      c.confrelid::regclass::text AS referenced_table,
      pg_get_constraintdef(c.oid, true) AS definition
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.connamespace = 'public'::regnamespace
    ORDER BY c.conrelid::regclass::text, c.conname
  `);

  const checks = await client.query(`
    SELECT
      c.conname AS name,
      c.conrelid::regclass::text AS table_name,
      pg_get_constraintdef(c.oid, true) AS definition
    FROM pg_constraint c
    WHERE c.contype = 'c'
      AND c.connamespace = 'public'::regnamespace
    ORDER BY c.conrelid::regclass::text, c.conname
  `);

  const indexes = await client.query(`
    SELECT
      tablename AS table_name,
      indexname AS name,
      indexdef AS definition
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname NOT LIKE '%_pkey'
      AND (indexdef ILIKE '% UNIQUE %' OR indexdef ILIKE '% WHERE %')
    ORDER BY tablename, indexname
  `);

  const triggers = await client.query(`
    SELECT
      event_object_table AS table_name,
      trigger_name AS name,
      string_agg(DISTINCT event_manipulation, ',' ORDER BY event_manipulation) AS events,
      min(action_timing) AS timing,
      min(action_statement) AS statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    GROUP BY event_object_table, trigger_name
    ORDER BY event_object_table, trigger_name
  `);

  const functions = await client.query(`
    SELECT
      p.proname AS name,
      pg_get_function_identity_arguments(p.oid) AS arguments,
      pg_get_function_result(p.oid) AS result,
      l.lanname AS language
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public'
    ORDER BY p.proname, arguments
  `);

  const extensions = await client.query(`
    SELECT extname AS name, extversion AS version
    FROM pg_extension
    ORDER BY extname
  `);

  section("FOREIGN KEYS", foreignKeys.rows);
  section("CHECK CONSTRAINTS", checks.rows);
  section("UNIQUE OR PARTIAL INDEXES", indexes.rows);
  section("USER TRIGGERS", triggers.rows);
  section("PUBLIC FUNCTIONS", functions.rows);
  section("EXTENSIONS", extensions.rows);
} finally {
  await client.end();
}
