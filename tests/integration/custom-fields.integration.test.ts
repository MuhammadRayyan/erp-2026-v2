import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { createCatalogItem } from "../../src/modules/catalog/server/catalog";
import {
  createCustomFieldDefinition,
  getCustomFieldsForEntity,
  saveCustomFieldValues,
  updateCustomFieldDefinition,
} from "../../src/modules/custom-fields/server/custom-fields";
import { createParty } from "../../src/modules/parties/server/parties";
import { onboardOwner } from "../../src/modules/tenancy/server/onboarding";

async function ownerContext(label: string) {
  const user = await db.user.create({ data: { id: randomUUID(), name: "Custom Field Owner", email: `${label}-${randomUUID()}@example.com`, emailVerified: true } });
  const operation = await onboardOwner({ idempotencyKey: `${label}-${randomUUID()}`, userId: user.id, tenantName: `${label} Tenant`, businessLegalName: `${label} Business LLC` });
  return { userId: user.id, tenantId: operation.tenantId, businessId: operation.businessId, roleKey: "business.owner", tenantName: `${label} Tenant`, businessName: `${label} Business LLC`, planKey: "internal-unlimited", planName: "Internal Unlimited", enabledFeatures: ["custom-fields.core", "parties.core", "catalog.core"] };
}

async function party(context: Awaited<ReturnType<typeof ownerContext>>, name: string) {
  return createParty(context, { type: "ORGANIZATION", legalName: name, email: `${randomUUID()}@example.com`, roles: ["CUSTOMER"] });
}

describe("typed custom fields", () => {
  it("stores and resolves all supported value types for a party", async () => {
    const context = await ownerContext("custom-types");
    const target = await party(context, "Typed Customer");
    const text = await createCustomFieldDefinition(context, { entityType: "PARTY", key: "service_zone", label: "Service zone", valueType: "TEXT", sortOrder: 1 });
    const longText = await createCustomFieldDefinition(context, { entityType: "PARTY", key: "site_notes", label: "Site notes", valueType: "LONG_TEXT", sortOrder: 2 });
    const number = await createCustomFieldDefinition(context, { entityType: "PARTY", key: "credit_days", label: "Credit days", valueType: "NUMBER", sortOrder: 3 });
    const date = await createCustomFieldDefinition(context, { entityType: "PARTY", key: "contract_date", label: "Contract date", valueType: "DATE", sortOrder: 4 });
    const boolean = await createCustomFieldDefinition(context, { entityType: "PARTY", key: "requires_gate_pass", label: "Requires gate pass", valueType: "BOOLEAN", sortOrder: 5 });
    const select = await createCustomFieldDefinition(context, { entityType: "PARTY", key: "priority", label: "Priority", valueType: "SELECT", required: true, sortOrder: 6, options: ["Standard", "Priority"] });

    await saveCustomFieldValues(context, "PARTY", target.id, { values: [
      { definitionId: text.id, value: "Dubai" },
      { definitionId: longText.id, value: "Use the service entrance." },
      { definitionId: number.id, value: "30.5000" },
      { definitionId: date.id, value: "2026-07-28" },
      { definitionId: boolean.id, value: false },
      { definitionId: select.id, value: "Priority" },
    ] });

    const fields = await getCustomFieldsForEntity(context, "PARTY", target.id);
    expect(fields.map((field) => field.value)).toEqual(["Dubai", "Use the service entrance.", "30.5", "2026-07-28", false, "Priority"]);
    const stored = await db.customFieldValue.findMany({ where: { tenantId: context.tenantId, businessId: context.businessId, entityId: target.id } });
    expect(stored).toHaveLength(6);
    expect(stored.filter((value) => value.numberValue !== null)[0]?.numberValue?.toString()).toBe("30.5");
    expect(await db.auditEvent.count({ where: { tenantId: context.tenantId, businessId: context.businessId, eventType: "CUSTOM_FIELD_VALUES_UPDATED", entityId: target.id } })).toBe(1);
  });

  it("enforces required values, types, and select option preservation", async () => {
    const context = await ownerContext("custom-validation");
    const target = await party(context, "Validation Customer");
    const required = await createCustomFieldDefinition(context, { entityType: "PARTY", key: "priority", label: "Priority", valueType: "SELECT", required: true, options: ["Standard", "Priority"] });
    const number = await createCustomFieldDefinition(context, { entityType: "PARTY", key: "discount_rate", label: "Discount rate", valueType: "NUMBER" });

    await expect(saveCustomFieldValues(context, "PARTY", target.id, { values: [{ definitionId: number.id, value: "10" }] })).rejects.toThrow("CUSTOM_FIELD_REQUIRED");
    await expect(saveCustomFieldValues(context, "PARTY", target.id, { values: [{ definitionId: required.id, value: "Unknown" }] })).rejects.toThrow("CUSTOM_FIELD_OPTION_INVALID");
    await expect(saveCustomFieldValues(context, "PARTY", target.id, { values: [{ definitionId: required.id, value: "Standard" }, { definitionId: number.id, value: "not-a-number" }] })).rejects.toThrow("CUSTOM_FIELD_VALUE_INVALID");

    await saveCustomFieldValues(context, "PARTY", target.id, { values: [{ definitionId: required.id, value: "Priority" }] });
    await expect(updateCustomFieldDefinition(context, required.id, { label: "Priority", required: true, active: true, sortOrder: 0, options: ["Standard"] })).rejects.toThrow("CUSTOM_FIELD_OPTION_IN_USE");
  });

  it("supports catalog values and enforces capability, entitlement, and tenant scope", async () => {
    const first = await ownerContext("custom-first");
    const second = await ownerContext("custom-second");
    const unit = await db.unitOfMeasure.findFirstOrThrow({ where: { tenantId: first.tenantId, businessId: first.businessId, code: "EA" } });
    const item = await createCatalogItem(first, { type: "PRODUCT", sku: `SKU-${randomUUID()}`, name: "Custom Product", unitId: unit.id, salesEnabled: true, purchaseEnabled: true, defaultSalesPrice: "20.0000", defaultPurchasePrice: "10.0000", salesAccountClassKey: "SALES_REVENUE", purchaseAccountClassKey: "INVENTORY_PURCHASES", defaultSalesTaxCategory: "STANDARD_RATE", defaultPurchaseTaxCategory: "STANDARD_RATE" });
    const definition = await createCustomFieldDefinition(first, { entityType: "CATALOG_ITEM", key: "manufacturer_code", label: "Manufacturer code", valueType: "TEXT" });

    await saveCustomFieldValues(first, "CATALOG_ITEM", item.id, { values: [{ definitionId: definition.id, value: "MFG-100" }] });
    expect((await getCustomFieldsForEntity(first, "CATALOG_ITEM", item.id))[0]?.value).toBe("MFG-100");
    await expect(saveCustomFieldValues({ ...first, roleKey: "business.viewer" }, "CATALOG_ITEM", item.id, { values: [{ definitionId: definition.id, value: "X" }] })).rejects.toThrow("BUSINESS_CAPABILITY_DENIED");
    await expect(saveCustomFieldValues(second, "CATALOG_ITEM", item.id, { values: [] })).rejects.toThrow("CUSTOM_FIELD_TARGET_NOT_FOUND");
    await expect(db.customFieldValue.create({ data: { tenantId: second.tenantId, businessId: second.businessId, definitionId: definition.id, entityType: "CATALOG_ITEM", valueType: "TEXT", entityId: item.id, textValue: "invalid", updatedByUserId: second.userId } })).rejects.toThrow();

    const feature = await db.featureDefinition.findUniqueOrThrow({ where: { key: "custom-fields.core" } });
    await db.tenantEntitlementOverride.create({ data: { tenantId: first.tenantId, featureId: feature.id, enabled: false, reason: "Integration test" } });
    await expect(getCustomFieldsForEntity(first, "CATALOG_ITEM", item.id)).rejects.toThrow("TENANT_FEATURE_DISABLED");
  });

  it("protects definition administration with settings permissions", async () => {
    const context = await ownerContext("custom-settings");
    await expect(createCustomFieldDefinition({ ...context, roleKey: "business.viewer" }, { entityType: "PARTY", key: "viewer_field", label: "Viewer field", valueType: "TEXT" })).rejects.toThrow("BUSINESS_CAPABILITY_DENIED");
  });
});
