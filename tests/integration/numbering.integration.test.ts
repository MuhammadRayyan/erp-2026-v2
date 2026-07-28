import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { allocateBusinessNumber, listNumberSequences, updateNumberSequence, voidNumberAllocation } from "../../src/modules/numbering/server/numbering";
import { onboardOwner } from "../../src/modules/tenancy/server/onboarding";

async function ownerContext(label: string) {
  const user = await db.user.create({ data: { id: randomUUID(), name: "Numbering Owner", email: `${label}-${randomUUID()}@example.com`, emailVerified: true } });
  const operation = await onboardOwner({ idempotencyKey: `${label}-${randomUUID()}`, userId: user.id, tenantName: `${label} Tenant`, businessLegalName: `${label} Business LLC` });
  return { userId: user.id, tenantId: operation.tenantId, businessId: operation.businessId, roleKey: "business.owner", tenantName: `${label} Tenant`, businessName: `${label} Business LLC`, planKey: "internal-unlimited", planName: "Internal Unlimited", enabledFeatures: ["core.settings"] };
}

describe("numbering foundation", () => {
  it("creates default sequences during onboarding", async () => {
    const context = await ownerContext("numbering-defaults");
    const sequences = await listNumberSequences(context);
    expect(sequences.map((sequence) => sequence.key).sort()).toEqual(["PAYMENT", "PURCHASE_ORDER", "QUOTATION", "RECEIPT", "SALES_INVOICE", "SALES_ORDER", "SUPPLIER_INVOICE"]);
  });

  it("allocates unique sequential values under concurrency", async () => {
    const context = await ownerContext("numbering-concurrency");
    const allocations = await Promise.all(Array.from({ length: 12 }, (_, index) => allocateBusinessNumber(context, {
      sequenceKey: "SALES_INVOICE",
      idempotencyKey: `invoice-${index}-${randomUUID()}`,
      effectiveDate: "2026-07-28",
      referenceType: "TEST_INVOICE",
      referenceId: String(index),
    })));
    expect(new Set(allocations.map((allocation) => allocation.formattedValue)).size).toBe(12);
    expect(allocations.map((allocation) => allocation.numericValue).sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
  });

  it("returns the same allocation for an idempotent retry", async () => {
    const context = await ownerContext("numbering-idempotency");
    const idempotencyKey = randomUUID();
    const first = await allocateBusinessNumber(context, { sequenceKey: "QUOTATION", idempotencyKey, effectiveDate: "2026-07-28" });
    const second = await allocateBusinessNumber(context, { sequenceKey: "QUOTATION", idempotencyKey, effectiveDate: "2026-07-28" });
    expect(second.id).toBe(first.id);
    expect(second.formattedValue).toBe(first.formattedValue);
    expect(await db.numberAllocation.count({ where: { sequenceId: first.sequenceId } })).toBe(1);
  });

  it("resets by effective year and never reuses a voided number", async () => {
    const context = await ownerContext("numbering-reset");
    const first = await allocateBusinessNumber(context, { sequenceKey: "RECEIPT", idempotencyKey: randomUUID(), effectiveDate: "2026-12-31" });
    const nextYear = await allocateBusinessNumber(context, { sequenceKey: "RECEIPT", idempotencyKey: randomUUID(), effectiveDate: "2027-01-01" });
    expect(first.formattedValue).toBe("RCPT-2026-00001");
    expect(nextYear.formattedValue).toBe("RCPT-2027-00001");
    await voidNumberAllocation(context, nextYear.id, { reason: "Test document cancelled" });
    const afterVoid = await allocateBusinessNumber(context, { sequenceKey: "RECEIPT", idempotencyKey: randomUUID(), effectiveDate: "2027-01-01" });
    expect(afterVoid.formattedValue).toBe("RCPT-2027-00002");
  });

  it("applies configuration changes only to future allocations", async () => {
    const context = await ownerContext("numbering-config");
    const sequence = (await listNumberSequences(context)).find((item) => item.key === "PURCHASE_ORDER")!;
    const original = await allocateBusinessNumber(context, { sequenceKey: sequence.key, idempotencyKey: randomUUID(), effectiveDate: "2026-07-28" });
    await updateNumberSequence(context, sequence.id, { label: "Purchase order", prefixTemplate: "PO-{YY}{MM}-", suffixTemplate: "", padding: 6, startValue: 1, resetPolicy: "MONTHLY", active: true });
    const changed = await allocateBusinessNumber(context, { sequenceKey: sequence.key, idempotencyKey: randomUUID(), effectiveDate: "2026-08-01" });
    expect(original.formattedValue).toBe("PO-2026-00001");
    expect(changed.formattedValue).toBe("PO-2608-000001");
    expect((await db.numberAllocation.findUniqueOrThrow({ where: { id: original.id } })).formattedValue).toBe("PO-2026-00001");
  });

  it("enforces settings RBAC and tenant boundaries", async () => {
    const first = await ownerContext("numbering-first");
    const second = await ownerContext("numbering-second");
    const sequence = (await listNumberSequences(first))[0];
    await expect(updateNumberSequence({ ...first, roleKey: "business.viewer" }, sequence.id, { label: sequence.label, prefixTemplate: sequence.prefixTemplate, suffixTemplate: sequence.suffixTemplate, padding: sequence.padding, startValue: sequence.startValue, resetPolicy: sequence.resetPolicy, active: sequence.active })).rejects.toThrow("BUSINESS_CAPABILITY_DENIED");
    await expect(updateNumberSequence(second, sequence.id, { label: sequence.label, prefixTemplate: sequence.prefixTemplate, suffixTemplate: sequence.suffixTemplate, padding: sequence.padding, startValue: sequence.startValue, resetPolicy: sequence.resetPolicy, active: sequence.active })).rejects.toThrow("NUMBER_SEQUENCE_NOT_FOUND");
  });
});
