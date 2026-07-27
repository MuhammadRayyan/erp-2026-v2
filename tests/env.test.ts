import { describe, expect, it } from "vitest";
import { parseEnvironment } from "../src/lib/env";

const validEnvironment = {
  DATABASE_URL: "postgresql://erp:erp@localhost:5432/erp",
  BETTER_AUTH_SECRET: "12345678901234567890123456789012",
  BETTER_AUTH_URL: "http://localhost:3000",
  APP_URL: "http://localhost:3000",
  NODE_ENV: "test",
};

describe("environment validation", () => {
  it("accepts the required application settings", () => {
    expect(parseEnvironment(validEnvironment).NODE_ENV).toBe("test");
  });

  it("rejects a short authentication secret", () => {
    expect(() => parseEnvironment({ ...validEnvironment, BETTER_AUTH_SECRET: "short" })).toThrow();
  });
});
