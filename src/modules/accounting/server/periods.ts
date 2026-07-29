import { Prisma, type AccountingPeriodStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireBusinessCapability } from "@/modules/access/server/authorize";
import { appendAuditEvent } from "@/modules/audit/server/audit";
import {
  accountingPeriodTransitionSchema,
  createAccountingPeriodSchema,
  formatAccountingDate,
  parseAccountingDate,
  updateAccountingPeriodSchema,
  type AccountingPeriodTransitionInput,
  type CreateAccountingPeriodInput,
  type UpdateAccountingPeriodInput,
} from "@/modules/accounting/contracts/periods";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";
import type { BusinessAccessContext } from "@/modules/tenancy/server/context";

async function requireAccounting(context: BusinessAccessContext, capability: "accounting.view" | "accounting.manage") {
  requireBusinessCapability(context, capability);
  await requireTenantFeature(context.tenantId, "accounting.core");
}

type LockedPeriod = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: AccountingPeriodStatus;
  statusReason: string | null;
};

async function lockPeriod(transaction: Prisma.TransactionClient, context: BusinessAccessContext, periodId: string) {
  const rows = await transaction.$queryRaw<LockedPeriod[]>`
    SELECT "id", "name", "startDate", "endDate", "status", "statusReason"
    FROM "AccountingPeriod"
    WHERE "id" = ${periodId} AND "tenantId" = ${context.tenantId} AND "businessId" = ${context.businessId}
    FOR UPDATE
  `;
  if (!rows[0]) throw new Error("ACCOUNTING_PERIOD_NOT_FOUND");
  return rows[0];
}

export async function listAccountingPeriods(context: BusinessAccessContext) {
  await requireAccounting(context, "accounting.view");
  return db.accountingPeriod.findMany({
    where: { tenantId: context.tenantId, businessId: context.businessId },
    orderBy: [{ startDate: "asc" }, { endDate: "asc" }],
  });
}

export async function getAccountingPeriod(context: BusinessAccessContext, periodId: string) {
  await requireAccounting(context, "accounting.view");
  const period = await db.accountingPeriod.findFirst({
    where: { id: periodId, tenantId: context.tenantId, businessId: context.businessId },
  });
  if (!period) throw new Error("ACCOUNTING_PERIOD_NOT_FOUND");
  return period;
}

export async function createAccountingPeriod(context: BusinessAccessContext, rawInput: CreateAccountingPeriodInput) {
  await requireAccounting(context, "accounting.manage");
  const input = createAccountingPeriodSchema.parse(rawInput);
  return db.$transaction(async (transaction) => {
    const period = await transaction.accountingPeriod.create({
      data: {
        tenantId: context.tenantId,
        businessId: context.businessId,
        name: input.name,
        startDate: parseAccountingDate(input.startDate),
        endDate: parseAccountingDate(input.endDate),
      },
    });
    await appendAuditEvent({
      transaction,
      context,
      eventType: "ACCOUNTING_PERIOD_CREATED",
      entityType: "ACCOUNTING_PERIOD",
      entityId: period.id,
      summary: `Accounting period ${period.name} created`,
      metadata: {
        name: period.name,
        startDate: formatAccountingDate(period.startDate),
        endDate: formatAccountingDate(period.endDate),
        status: period.status,
      },
    });
    return period;
  });
}

export async function updateAccountingPeriod(
  context: BusinessAccessContext,
  periodId: string,
  rawInput: UpdateAccountingPeriodInput,
) {
  await requireAccounting(context, "accounting.manage");
  const input = updateAccountingPeriodSchema.parse(rawInput);
  return db.$transaction(async (transaction) => {
    const current = await lockPeriod(transaction, context, periodId);
    if (current.status !== "OPEN") throw new Error("ACCOUNTING_PERIOD_DATES_LOCKED");
    const period = await transaction.accountingPeriod.update({
      where: { id: periodId },
      data: {
        name: input.name,
        startDate: parseAccountingDate(input.startDate),
        endDate: parseAccountingDate(input.endDate),
      },
    });
    await appendAuditEvent({
      transaction,
      context,
      eventType: "ACCOUNTING_PERIOD_UPDATED",
      entityType: "ACCOUNTING_PERIOD",
      entityId: period.id,
      summary: `Accounting period ${period.name} updated`,
      metadata: {
        previous: {
          name: current.name,
          startDate: formatAccountingDate(current.startDate),
          endDate: formatAccountingDate(current.endDate),
        },
        current: {
          name: period.name,
          startDate: formatAccountingDate(period.startDate),
          endDate: formatAccountingDate(period.endDate),
        },
      },
    });
    return period;
  });
}

export async function transitionAccountingPeriod(
  context: BusinessAccessContext,
  periodId: string,
  rawInput: AccountingPeriodTransitionInput,
) {
  await requireAccounting(context, "accounting.manage");
  const input = accountingPeriodTransitionSchema.parse(rawInput);
  return db.$transaction(async (transaction) => {
    const current = await lockPeriod(transaction, context, periodId);
    if (current.status === input.status) return transaction.accountingPeriod.findUniqueOrThrow({ where: { id: periodId } });

    const period = await transaction.accountingPeriod.update({
      where: { id: periodId },
      data: {
        status: input.status,
        statusReason: input.reason,
        statusChangedAt: new Date(),
      },
    });
    await appendAuditEvent({
      transaction,
      context,
      eventType: "ACCOUNTING_PERIOD_STATUS_CHANGED",
      entityType: "ACCOUNTING_PERIOD",
      entityId: period.id,
      summary: `Accounting period ${period.name} changed from ${current.status} to ${period.status}`,
      metadata: {
        previousStatus: current.status,
        status: period.status,
        reason: input.reason,
        startDate: formatAccountingDate(period.startDate),
        endDate: formatAccountingDate(period.endDate),
      },
    });
    return period;
  });
}

export async function assertAccountingDateOpen(
  transaction: Prisma.TransactionClient,
  context: Pick<BusinessAccessContext, "tenantId" | "businessId">,
  accountingDate: Date,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string; name: string; status: AccountingPeriodStatus }>>`
    SELECT "id", "name", "status"
    FROM "AccountingPeriod"
    WHERE "tenantId" = ${context.tenantId}
      AND "businessId" = ${context.businessId}
      AND ${accountingDate}::date BETWEEN "startDate" AND "endDate"
    FOR SHARE
  `;
  const period = rows[0];
  if (!period) throw new Error("ACCOUNTING_PERIOD_NOT_FOUND_FOR_DATE");
  if (period.status === "SOFT_LOCKED") throw new Error("ACCOUNTING_PERIOD_SOFT_LOCKED");
  if (period.status === "CLOSED") throw new Error("ACCOUNTING_PERIOD_CLOSED");
  return period;
}
