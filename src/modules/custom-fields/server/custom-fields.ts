import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireBusinessCapability } from "@/modules/access/server/authorize";
import type { BusinessCapability } from "@/modules/access/roles";
import { appendAuditEvent } from "@/modules/audit/server/audit";
import {
  createCustomFieldDefinitionSchema,
  customFieldEntityTypeSchema,
  saveCustomFieldValuesSchema,
  updateCustomFieldDefinitionSchema,
  type CreateCustomFieldDefinitionInput,
  type CustomFieldEntityTypeInput,
  type SaveCustomFieldValuesInput,
  type UpdateCustomFieldDefinitionInput,
} from "@/modules/custom-fields/contracts/custom-fields";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";
import type { BusinessAccessContext } from "@/modules/tenancy/server/context";

const entityCapabilities: Record<CustomFieldEntityTypeInput, { view: BusinessCapability; manage: BusinessCapability }> = {
  PARTY: { view: "parties.view", manage: "parties.manage" },
  CATALOG_ITEM: { view: "catalog.view", manage: "catalog.manage" },
};

async function requireCustomFields(context: BusinessAccessContext) {
  await requireTenantFeature(context.tenantId, "custom-fields.core");
}

function optionsFrom(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value) ? value.filter((option): option is string => typeof option === "string") : [];
}

function isEmpty(value: string | boolean | null | undefined) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function valueColumns(definition: { valueType: string; options: Prisma.JsonValue | null }, rawValue: string | boolean) {
  if (definition.valueType === "BOOLEAN") {
    if (typeof rawValue !== "boolean") throw new Error("CUSTOM_FIELD_VALUE_INVALID");
    return { textValue: null, numberValue: null, dateValue: null, booleanValue: rawValue };
  }
  if (typeof rawValue !== "string") throw new Error("CUSTOM_FIELD_VALUE_INVALID");
  const value = rawValue.trim();
  if (definition.valueType === "TEXT" && value.length > 500) throw new Error("CUSTOM_FIELD_VALUE_INVALID");
  if (definition.valueType === "LONG_TEXT" && value.length > 5000) throw new Error("CUSTOM_FIELD_VALUE_INVALID");
  if (definition.valueType === "NUMBER") {
    if (!/^-?\d{1,15}(\.\d{1,4})?$/.test(value)) throw new Error("CUSTOM_FIELD_VALUE_INVALID");
    return { textValue: null, numberValue: value, dateValue: null, booleanValue: null };
  }
  if (definition.valueType === "DATE") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) throw new Error("CUSTOM_FIELD_VALUE_INVALID");
    return { textValue: null, numberValue: null, dateValue: new Date(`${value}T00:00:00.000Z`), booleanValue: null };
  }
  if (definition.valueType === "SELECT" && !optionsFrom(definition.options).includes(value)) throw new Error("CUSTOM_FIELD_OPTION_INVALID");
  return { textValue: value, numberValue: null, dateValue: null, booleanValue: null };
}

async function assertAndLockTarget(transaction: Prisma.TransactionClient, context: BusinessAccessContext, entityType: CustomFieldEntityTypeInput, entityId: string) {
  const rows = entityType === "PARTY"
    ? await transaction.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Party" WHERE "id" = ${entityId} AND "tenantId" = ${context.tenantId} AND "businessId" = ${context.businessId} FOR UPDATE`
    : await transaction.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "CatalogItem" WHERE "id" = ${entityId} AND "tenantId" = ${context.tenantId} AND "businessId" = ${context.businessId} FOR UPDATE`;
  if (!rows[0]) throw new Error("CUSTOM_FIELD_TARGET_NOT_FOUND");
}

export async function listCustomFieldDefinitions(context: BusinessAccessContext, rawEntityType?: unknown) {
  requireBusinessCapability(context, "settings.view");
  await requireCustomFields(context);
  const entityType = rawEntityType ? customFieldEntityTypeSchema.parse(rawEntityType) : undefined;
  return db.customFieldDefinition.findMany({
    where: { tenantId: context.tenantId, businessId: context.businessId, ...(entityType ? { entityType } : {}) },
    orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
  });
}

export async function createCustomFieldDefinition(context: BusinessAccessContext, rawInput: CreateCustomFieldDefinitionInput) {
  requireBusinessCapability(context, "settings.manage");
  await requireCustomFields(context);
  const input = createCustomFieldDefinitionSchema.parse(rawInput);
  return db.$transaction(async (transaction) => {
    const definition = await transaction.customFieldDefinition.create({
      data: {
        tenantId: context.tenantId,
        businessId: context.businessId,
        entityType: input.entityType,
        key: input.key,
        label: input.label,
        description: input.description,
        valueType: input.valueType,
        required: input.required,
        active: input.active,
        sortOrder: input.sortOrder,
        options: input.valueType === "SELECT" ? input.options! : Prisma.DbNull,
      },
    });
    await appendAuditEvent({ transaction, context, eventType: "CUSTOM_FIELD_DEFINITION_CREATED", entityType: "CUSTOM_FIELD_DEFINITION", entityId: definition.id, summary: `Created custom field ${definition.label}`, metadata: { key: definition.key, target: definition.entityType, valueType: definition.valueType } });
    return definition;
  });
}

export async function updateCustomFieldDefinition(context: BusinessAccessContext, definitionId: string, rawInput: UpdateCustomFieldDefinitionInput) {
  requireBusinessCapability(context, "settings.manage");
  await requireCustomFields(context);
  const input = updateCustomFieldDefinitionSchema.parse(rawInput);
  return db.$transaction(async (transaction) => {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "CustomFieldDefinition" WHERE "id" = ${definitionId} AND "tenantId" = ${context.tenantId} AND "businessId" = ${context.businessId} FOR UPDATE`;
    if (!locked[0]) throw new Error("CUSTOM_FIELD_DEFINITION_NOT_FOUND");
    const existing = await transaction.customFieldDefinition.findUniqueOrThrow({ where: { id: definitionId } });
    if (existing.valueType === "SELECT") {
      if (!input.options) throw new Error("CUSTOM_FIELD_OPTIONS_REQUIRED");
      const removedOptions = optionsFrom(existing.options).filter((option) => !input.options!.includes(option));
      if (removedOptions.length > 0) {
        const used = await transaction.customFieldValue.count({ where: { tenantId: context.tenantId, businessId: context.businessId, definitionId, textValue: { in: removedOptions } } });
        if (used > 0) throw new Error("CUSTOM_FIELD_OPTION_IN_USE");
      }
    } else if (input.options) throw new Error("CUSTOM_FIELD_OPTIONS_NOT_ALLOWED");
    const definition = await transaction.customFieldDefinition.update({
      where: { id: definitionId },
      data: { label: input.label, description: input.description, required: input.required, active: input.active, sortOrder: input.sortOrder, options: existing.valueType === "SELECT" ? input.options! : Prisma.DbNull },
    });
    await appendAuditEvent({ transaction, context, eventType: "CUSTOM_FIELD_DEFINITION_UPDATED", entityType: "CUSTOM_FIELD_DEFINITION", entityId: definition.id, summary: `Updated custom field ${definition.label}`, metadata: { active: definition.active, required: definition.required, sortOrder: definition.sortOrder } });
    return definition;
  });
}

export async function getCustomFieldsForEntity(context: BusinessAccessContext, rawEntityType: unknown, entityId: string) {
  const entityType = customFieldEntityTypeSchema.parse(rawEntityType);
  requireBusinessCapability(context, entityCapabilities[entityType].view);
  await requireCustomFields(context);
  const targetExists = entityType === "PARTY"
    ? await db.party.count({ where: { id: entityId, tenantId: context.tenantId, businessId: context.businessId } })
    : await db.catalogItem.count({ where: { id: entityId, tenantId: context.tenantId, businessId: context.businessId } });
  if (!targetExists) throw new Error("CUSTOM_FIELD_TARGET_NOT_FOUND");
  const definitions = await db.customFieldDefinition.findMany({
    where: { tenantId: context.tenantId, businessId: context.businessId, entityType, active: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  const values = await db.customFieldValue.findMany({ where: { tenantId: context.tenantId, businessId: context.businessId, entityType, entityId } });
  const byDefinition = new Map(values.map((value) => [value.definitionId, value]));
  return definitions.map((definition) => {
    const value = byDefinition.get(definition.id);
    const serializedValue = value?.textValue ?? value?.numberValue?.toString() ?? value?.dateValue?.toISOString().slice(0, 10) ?? value?.booleanValue ?? null;
    return { definition: { ...definition, options: optionsFrom(definition.options) }, value: serializedValue };
  });
}

export async function saveCustomFieldValues(context: BusinessAccessContext, rawEntityType: unknown, entityId: string, rawInput: SaveCustomFieldValuesInput) {
  const entityType = customFieldEntityTypeSchema.parse(rawEntityType);
  requireBusinessCapability(context, entityCapabilities[entityType].manage);
  await requireCustomFields(context);
  const input = saveCustomFieldValuesSchema.parse(rawInput);
  if (new Set(input.values.map((value) => value.definitionId)).size !== input.values.length) throw new Error("CUSTOM_FIELD_VALUE_DUPLICATE");
  return db.$transaction(async (transaction) => {
    await assertAndLockTarget(transaction, context, entityType, entityId);
    const definitions = await transaction.customFieldDefinition.findMany({ where: { tenantId: context.tenantId, businessId: context.businessId, entityType, active: true }, orderBy: { sortOrder: "asc" } });
    const byId = new Map(definitions.map((definition) => [definition.id, definition]));
    const submitted = new Map(input.values.map((value) => [value.definitionId, value.value]));
    for (const definition of definitions) {
      if (definition.required && isEmpty(submitted.get(definition.id))) throw new Error("CUSTOM_FIELD_REQUIRED");
    }
    for (const definitionId of submitted.keys()) if (!byId.has(definitionId)) throw new Error("CUSTOM_FIELD_DEFINITION_NOT_FOUND");
    const definitionIds = definitions.map((definition) => definition.id);
    await transaction.customFieldValue.deleteMany({ where: { tenantId: context.tenantId, businessId: context.businessId, entityId, definitionId: { in: definitionIds } } });
    let savedCount = 0;
    for (const [definitionId, rawValue] of submitted) {
      if (isEmpty(rawValue)) continue;
      const definition = byId.get(definitionId)!;
      const columns = valueColumns(definition, rawValue as string | boolean);
      await transaction.customFieldValue.create({
        data: { tenantId: context.tenantId, businessId: context.businessId, definitionId, entityType, valueType: definition.valueType, entityId, ...columns, updatedByUserId: context.userId },
      });
      savedCount += 1;
    }
    await appendAuditEvent({ transaction, context, eventType: "CUSTOM_FIELD_VALUES_UPDATED", entityType, entityId, summary: "Updated custom fields", metadata: { savedCount, definitionCount: definitions.length } });
    return { savedCount };
  });
}
