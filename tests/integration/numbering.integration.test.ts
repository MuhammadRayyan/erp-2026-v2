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

  it("returns the same allocation only for an equivalent idempotent retry", async () => {
    const context = await ownerContext("numbering-idempotency");
    const idempotencyKey = randomUUID();
    const first = await allocateBusinessNumber(context, { sequenceKey: "QUOTATION", idempotencyKey, effectiveDate: "2026-07-28", referenceType: "QUOTE", referenceId: "one" });
    const second = await allocateBusinessNumber(context, { sequenceKey: "QUOTATION", idempotencyKey, effectiveDate: "2026-07-28", referenceType: "QUOTE", referenceId: "one" });
    expect(second.id).toBe(first.id);
    expect(second.formattedValue).toBe(first.formattedValue);
    await expect(allocateBusinessNumber(context, { sequenceKey: "QUOTATION", idempotencyKey, effectiveDate: "2026-07-29", referenceType: "QUOTE", referenceId: "two" })).rejects.toThrow("NUMBER_IDEMPOTENCY_CONFLICT");
    expect(await db.numberAllocation.count({ where: { sequenceId: first.sequenceId } })).toBe(1);
  });

  it("resets by effective year and never reuses a voided number", async () => {
    const context = await ownerContext("numbering-reset");
    const first = await allocateBusinessNumber(context, { sequenceKey: "RECEIPT", idempotencyKey: randomUUID(), effectiveDate: "2026-12-31" });
    const nextYear = await allocateBusinessNumber(context, { sequenceKey: "RECEIPT", idempotencyKey: randomUUID(), effectiveDate: "2027-01-01" });
    expect(first.formattedValue).toBe("RCPT-2026-00001");
    expect(nextYear.formattedValue).toBe("RCPT-2027-00001");
    await Promise.all([
      voidNumberAllocation(context, nextYear.id, { reason: "Test document cancelled" }),
      voidNumberAllocation(context, nextYear.id, { reason: "Repeated cancellation request" }),
    ]);
    const afterVoid = await allocateBusinessNumber(context, { sequenceKey: "RECEIPT", idempotencyKey: randomUUID(), effectiveDate: "2027-01-01" });
    expect(afterVoid.formattedValue).toBe("RCPT-2027-00002");
    expect(await db.auditEvent.count({ where: { entityType: "NUMBER_ALLOCATION", entityId: nextYear.id, eventType: "NUMBER_VOIDED" } })).toBe(1);
  });

  it("applies format changes only to future allocations and freezes unsafe policy changes", async () => {
    const context = await ownerContext("numbering-config");
    const sequence = (await listNumberSequences(context)).find((item) => item.key === "PURCHASE_ORDER")!;
    const original = await allocateBusinessNumber(context, { sequenceKey: sequence.key, idempotencyKey: randomUUID(), effectiveDate: "2026-07-28" });
    await updateNumberSequence(context, sequence.id, { label: "Purchase order", prefixTemplate: "PO-{YY}{MM}-", suffixTemplate: "", padding: 6, startValue: sequence.startValue, resetPolicy: sequence.resetPolicy, active: true });
    const changed = await allocateBusinessNumber(context, { sequenceKey: sequence.key, idempotencyKey: randomUUID(), effectiveDate: "2026-08-01" });
    expect(original.formattedValue).toBe("PO-2026-00001");
    expect(changed.formattedValue).toBe("PO-2608-000002");
    expect((await db.numberAllocation.findUniqueOrThrow({ where: { id: original.id } })).formattedValue).toBe("PO-2026-00001");
    await expect(updateNumberSequence(context, sequence.id, { label: "Purchase order", prefixTemplate: "PO-", suffixTemplate: "", padding: 5, startValue: 100, resetPolicy: "NEVER", active: true })).rejects.toThrow("NUMBER_SEQUENCE_POLICY_LOCKED");
  });

  it("enforces settings RBAC and tenant boundaries", async () => {
    const first = await ownerContext("numbering-first");
    const second = await ownerContext("numbering-second");
    const sequence = (await listNumberSequences(first))[0];
    await expect(updateNumberSequence({ ...first, roleKey: "business.viewer" }, sequence.id, { label: sequence.label, prefixTemplate: sequence.prefixTemplate, suffixTemplate: sequence.suffixTemplate, padding: sequence.padding, startValue: sequence.startValue, resetPolicy: sequence.resetPolicy, active: sequence.active })).rejects.toThrow("BUSINESS_CAPABILITY_DENIED");
    await expect(updateNumberSequence(second, sequence.id, { label: sequence.label, prefixTemplate: sequence.prefixTemplate, suffixTemplate: sequence.suffixTemplate, padding: sequence.padding, startValue: sequence.startValue, resetPolicy: sequence.resetPolicy, active: sequence.active })).rejects.toThrow("NUMBER_SEQUENCE_NOT_FOUND");
  });
});
