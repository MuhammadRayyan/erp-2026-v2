import { describe, expect, it } from "vitest";
import { isSerializableConflict } from "../src/modules/tenancy/server/onboarding";

describe("onboarding serialization retry detection", () => {
  it("recognizes Prisma, PostgreSQL, and adapter conflict shapes", () => {
    expect(isSerializableConflict({ code: "P2034" })).toBe(true);
    expect(isSerializableConflict({ meta: { driverAdapterError: { cause: { originalCode: "40001" } } } })).toBe(true);
    expect(isSerializableConflict(new Error("TransactionWriteConflict"))).toBe(true);
    expect(isSerializableConflict({ cause: { name: "TransactionWriteConflict" } })).toBe(true);
    expect(isSerializableConflict({ message: "could not serialize access due to read/write dependencies" })).toBe(true);
  });

  it("does not retry unrelated validation or uniqueness failures", () => {
    expect(isSerializableConflict({ code: "P2002", message: "Unique constraint failed" })).toBe(false);
    expect(isSerializableConflict(new Error("DEFAULT_PLAN_UNAVAILABLE"))).toBe(false);
    expect(isSerializableConflict(null)).toBe(false);
  });
});