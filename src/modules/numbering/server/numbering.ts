import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireBusinessCapability } from "@/modules/access/server/authorize";
import { appendAuditEvent } from "@/modules/audit/server/audit";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";
import {
  allocateNumberSchema,
  updateNumberSequenceSchema,
  voidNumberAllocationSchema,
  type AllocateNumberInput,
  type UpdateNumberSequenceInput,
} from "@/modules/numbering/contracts/numbering";
import type { BusinessAccessContext } from "@/modules/tenancy/server/context";

function parseEffectiveDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("NUMBER_EFFECTIVE_DATE_INVALID");
  }
  return date;
}

function periodKey(policy: "NEVER" | "YEARLY" | "MONTHLY", dateValue: string) {
  if (policy === "NEVER") return "ALL";
  if (policy === "YEARLY") return dateValue.slice(0, 4);
  return dateValue.slice(0, 7);
}

function renderTemplate(template: string, dateValue: string) {
  const year = dateValue.slice(0, 4);
  const month = dateValue.slice(5, 7);
  return template.replaceAll("{YYYY}", year).replaceAll("{YY}", year.slice(2)).replaceAll("{MM}", month);
}

async function requireNumberingSettings(context: BusinessAccessContext, capability: "settings.view" | "settings.manage") {
  requireBusinessCapability(context, capability);
  await requireTenantFeature(context.tenantId, "core.settings");
}

export async function listNumberSequences(context: BusinessAccessContext) {
  await requireNumberingSettings(context, "settings.view");
  return db.numberSequence.findMany({
    where: { tenantId: context.tenantId, businessId: context.businessId },
    include: { allocations: { orderBy: { createdAt: "desc" }, take: 5 } },
    orderBy: { label: "asc" },
  });
}

export async function updateNumberSequence(context: BusinessAccessContext, sequenceId: string, rawInput: UpdateNumberSequenceInput) {
  await requireNumberingSettings(context, "settings.manage");
  const input = updateNumberSequenceSchema.parse(rawInput);
  return db.$transaction(async (transaction) => {
    const sequence = await transaction.numberSequence.findFirst({
      where: { id: sequenceId, tenantId: context.tenantId, businessId: context.businessId },
    });
    if (!sequence) throw new Error("NUMBER_SEQUENCE_NOT_FOUND");
    const allocationCount = await transaction.numberAllocation.count({ where: { sequenceId: sequence.id } });
    const updated = await transaction.numberSequence.update({
      where: { id: sequence.id },
      data: {
        label: input.label,
        prefixTemplate: input.prefixTemplate,
        suffixTemplate: input.suffixTemplate,
        padding: input.padding,
        startValue: input.startValue,
        resetPolicy: input.resetPolicy,
        active: input.active,
        ...(allocationCount === 0 ? { nextValue: input.startValue, currentPeriodKey: null } : {}),
      },
    });
    await appendAuditEvent({
      transaction,
      context,
      eventType: "NUMBER_SEQUENCE_UPDATED",
      entityType: "NUMBER_SEQUENCE",
      entityId: sequence.id,
      summary: `Updated ${updated.label} numbering`,
      metadata: {
        key: updated.key,
        prefixTemplate: updated.prefixTemplate,
        suffixTemplate: updated.suffixTemplate,
        padding: updated.padding,
        startValue: updated.startValue,
        resetPolicy: updated.resetPolicy,
        active: updated.active,
      },
    });
    return updated;
  });
}

type LockedSequence = {
  id: string;
  key: string;
  label: string;
  prefixTemplate: string;
  suffixTemplate: string;
  padding: number;
  startValue: number;
  nextValue: number;
  resetPolicy: "NEVER" | "YEARLY" | "MONTHLY";
  currentPeriodKey: string | null;
  active: boolean;
};

export async function allocateNumberInTransaction(
  transaction: Prisma.TransactionClient,
  context: BusinessAccessContext,
  rawInput: AllocateNumberInput,
) {
  const input = allocateNumberSchema.parse(rawInput);
  const existing = await transaction.numberAllocation.findFirst({
    where: {
      tenantId: context.tenantId,
      businessId: context.businessId,
      sequence: { key: input.sequenceKey },
      idempotencyKey: input.idempotencyKey,
    },
  });
  if (existing) return existing;

  const locked = await transaction.$queryRaw<LockedSequence[]>`
    SELECT "id", "key", "label", "prefixTemplate", "suffixTemplate", "padding", "startValue", "nextValue", "resetPolicy"::text, "currentPeriodKey", "active"
    FROM "NumberSequence"
    WHERE "tenantId" = ${context.tenantId} AND "businessId" = ${context.businessId} AND "key" = ${input.sequenceKey}
    FOR UPDATE
  `;
  const sequence = locked[0];
  if (!sequence || !sequence.active) throw new Error("NUMBER_SEQUENCE_NOT_FOUND");

  const repeated = await transaction.numberAllocation.findFirst({
    where: { tenantId: context.tenantId, businessId: context.businessId, sequenceId: sequence.id, idempotencyKey: input.idempotencyKey },
  });
  if (repeated) return repeated;

  const effectiveDate = parseEffectiveDate(input.effectiveDate);
  const allocationPeriod = periodKey(sequence.resetPolicy, input.effectiveDate);
  const numericValue = sequence.currentPeriodKey === allocationPeriod ? sequence.nextValue : sequence.startValue;
  const formattedValue = `${renderTemplate(sequence.prefixTemplate, input.effectiveDate)}${String(numericValue).padStart(sequence.padding, "0")}${renderTemplate(sequence.suffixTemplate, input.effectiveDate)}`;

  const allocation = await transaction.numberAllocation.create({
    data: {
      tenantId: context.tenantId,
      businessId: context.businessId,
      sequenceId: sequence.id,
      idempotencyKey: input.idempotencyKey,
      effectiveDate,
      periodKey: allocationPeriod,
      numericValue,
      formattedValue,
      referenceType: input.referenceType || null,
      referenceId: input.referenceId || null,
      allocatedById: context.userId,
    },
  });
  await transaction.numberSequence.update({
    where: { id: sequence.id },
    data: { currentPeriodKey: allocationPeriod, nextValue: numericValue + 1 },
  });
  await appendAuditEvent({
    transaction,
    context,
    eventType: "NUMBER_ALLOCATED",
    entityType: "NUMBER_ALLOCATION",
    entityId: allocation.id,
    summary: `Allocated ${formattedValue}`,
    metadata: { sequenceKey: sequence.key, effectiveDate: input.effectiveDate, periodKey: allocationPeriod, numericValue, referenceType: input.referenceType || null, referenceId: input.referenceId || null },
  });
  return allocation;
}

export async function allocateBusinessNumber(context: BusinessAccessContext, rawInput: AllocateNumberInput) {
  await requireTenantFeature(context.tenantId, "core.settings");
  return db.$transaction((transaction) => allocateNumberInTransaction(transaction, context, rawInput));
}

export async function voidNumberAllocation(context: BusinessAccessContext, allocationId: string, rawInput: unknown) {
  await requireNumberingSettings(context, "settings.manage");
  const { reason } = voidNumberAllocationSchema.parse(rawInput);
  return db.$transaction(async (transaction) => {
    const allocation = await transaction.numberAllocation.findFirst({
      where: { id: allocationId, tenantId: context.tenantId, businessId: context.businessId },
    });
    if (!allocation) throw new Error("NUMBER_ALLOCATION_NOT_FOUND");
    if (allocation.status === "VOIDED") return allocation;
    const updated = await transaction.numberAllocation.update({
      where: { id: allocation.id },
      data: { status: "VOIDED", voidedAt: new Date(), voidedById: context.userId, voidReason: reason },
    });
    await appendAuditEvent({ transaction, context, eventType: "NUMBER_VOIDED", entityType: "NUMBER_ALLOCATION", entityId: allocation.id, summary: `Voided ${allocation.formattedValue}`, metadata: { reason, sequenceId: allocation.sequenceId } });
    return updated;
  });
}
