import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "./server-env";

const globalForDatabase = globalThis as unknown as {
  database?: PrismaClient;
};

function createDatabaseClient() {
  const adapter = new PrismaPg({
    connectionString: serverEnv.DATABASE_URL,
    max: serverEnv.NODE_ENV === "test" ? 5 : 10,
    connectionTimeoutMillis: 5_000,
  });

  return new PrismaClient({ adapter });
}

export const db = globalForDatabase.database ?? createDatabaseClient();

if (serverEnv.NODE_ENV !== "production") {
  globalForDatabase.database = db;
}
