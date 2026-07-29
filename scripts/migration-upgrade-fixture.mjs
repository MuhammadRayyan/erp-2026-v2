import pg from "pg";

const { Client } = pg;
const connectionString = process.env.UPGRADE_DATABASE_URL;
if (!connectionString) throw new Error("UPGRADE_DATABASE_URL is required.");

const action = process.argv[2];
if (!new Set(["reset", "seed", "verify"]).has(action)) {
  throw new Error("Use reset, seed, or verify.");
}

const targetUrl = new URL(connectionString);
const databaseName = decodeURIComponent(targetUrl.pathname.slice(1));
if (!/^[A-Za-z0-9_]+$/.test(databaseName)) throw new Error("Upgrade database name must contain only letters, numbers, or underscores.");

const identifiers = {
  userId: "migration-upgrade-user",
  tenantId: "migration-upgrade-tenant",
  membershipId: "migration-upgrade-membership",
  businessId: "migration-upgrade-business",
  unitId: "migration-upgrade-unit",
  partyId: "migration-upgrade-party",
};

async function resetDatabase() {
  const adminUrl = new URL(connectionString);
  adminUrl.pathname = "/postgres";
  const client = new Client({ connectionString: adminUrl.toString() });
  try {
    await client.connect();
    await client.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [databaseName],
    );
    await client.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await client.query(`CREATE DATABASE "${databaseName}"`);
    console.log(`Prepared clean upgrade database ${databaseName}.`);
  } finally {
    await client.end();
  }
}

async function seedDatabase() {
  const client = new Client({ connectionString });
  const timestamp = new Date("2026-07-29T00:00:00.000Z");
  try {
    await client.connect();
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO "User" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, 'Migration Upgrade User', 'migration-upgrade@example.test', true, $2, $2)`,
      [identifiers.userId, timestamp],
    );
    await client.query(
      `INSERT INTO "Tenant" ("id", "slug", "name", "status", "createdAt", "updatedAt")
       VALUES ($1, 'migration-upgrade-tenant', 'Migration Upgrade Tenant', 'ACTIVE', $2, $2)`,
      [identifiers.tenantId, timestamp],
    );
    await client.query(
      `INSERT INTO "TenantMembership" ("id", "tenantId", "userId", "status", "isOwner", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'ACTIVE', true, $4, $4)`,
      [identifiers.membershipId, identifiers.tenantId, identifiers.userId, timestamp],
    );
    await client.query(
      `INSERT INTO "Business" ("id", "tenantId", "slug", "legalName", "tradingName", "countryCode", "baseCurrency", "timezone", "createdAt", "updatedAt")
       VALUES ($1, $2, 'migration-upgrade-business', 'Migration Upgrade Business LLC', 'Migration Upgrade Business', 'AE', 'AED', 'Asia/Dubai', $3, $3)`,
      [identifiers.businessId, identifiers.tenantId, timestamp],
    );
    await client.query(
      `INSERT INTO "UnitOfMeasure" ("id", "tenantId", "businessId", "code", "name", "symbol", "dimension", "decimalPlaces", "active", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'UPG', 'Upgrade unit', 'upg', 'COUNT', 2, true, $4, $4)`,
      [identifiers.unitId, identifiers.tenantId, identifiers.businessId, timestamp],
    );
    await client.query(
      `INSERT INTO "Party" ("id", "tenantId", "businessId", "type", "status", "displayName", "legalName", "searchText", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'ORGANIZATION', 'ACTIVE', 'Migration Upgrade Customer', 'Migration Upgrade Customer LLC', 'migration upgrade customer', $4, $4)`,
      [identifiers.partyId, identifiers.tenantId, identifiers.businessId, timestamp],
    );
    await client.query("COMMIT");
    console.log("Inserted migration upgrade sentinels.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

async function verifyDatabase() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query(
      `SELECT
         u."email",
         t."name" AS tenant_name,
         tm."isOwner" AS is_owner,
         b."legalName" AS business_name,
         unit."code" AS unit_code,
         p."displayName" AS party_name
       FROM "User" u
       JOIN "TenantMembership" tm ON tm."userId" = u."id"
       JOIN "Tenant" t ON t."id" = tm."tenantId"
       JOIN "Business" b ON b."tenantId" = t."id"
       JOIN "UnitOfMeasure" unit ON unit."tenantId" = b."tenantId" AND unit."businessId" = b."id"
       JOIN "Party" p ON p."tenantId" = b."tenantId" AND p."businessId" = b."id"
       WHERE u."id" = $1 AND t."id" = $2 AND b."id" = $3 AND unit."id" = $4 AND p."id" = $5`,
      [identifiers.userId, identifiers.tenantId, identifiers.businessId, identifiers.unitId, identifiers.partyId],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Migration upgrade sentinel graph is missing.");
    const expected = {
      email: "migration-upgrade@example.test",
      tenant_name: "Migration Upgrade Tenant",
      is_owner: true,
      business_name: "Migration Upgrade Business LLC",
      unit_code: "UPG",
      party_name: "Migration Upgrade Customer",
    };
    for (const [key, value] of Object.entries(expected)) {
      if (row[key] !== value) throw new Error(`Migration upgrade sentinel ${key} is ${row[key]}, expected ${value}.`);
    }
    console.log("Migration upgrade sentinels preserved.");
  } finally {
    await client.end();
  }
}

if (action === "reset") await resetDatabase();
if (action === "seed") await seedDatabase();
if (action === "verify") await verifyDatabase();
