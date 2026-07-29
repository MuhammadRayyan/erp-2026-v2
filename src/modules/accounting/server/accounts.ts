import { Prisma, type AccountClass, type AccountStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireBusinessCapability } from "@/modules/access/server/authorize";
import { appendAuditEvent } from "@/modules/audit/server/audit";
import {
  createLedgerAccountSchema,
  ledgerAccountStatusSchema,
  updateLedgerAccountSchema,
  type CreateLedgerAccountInput,
  type UpdateLedgerAccountInput,
} from "@/modules/accounting/contracts/accounts";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";
import type { BusinessAccessContext } from "@/modules/tenancy/server/context";

async function requireAccounting(context: BusinessAccessContext, capability: "accounting.view" | "accounting.manage") {
  requireBusinessCapability(context, capability);
  await requireTenantFeature(context.tenantId, "accounting.core");
}

type LockedAccount = {
  id: string;
  code: string;
  name: string;
  class: AccountClass;
  type: string;
  normalBalance: string;
  kind: string;
  isContra: boolean;
  manualPostingAllowed: boolean;
  systemKey: string | null;
  systemManaged: boolean;
  required: boolean;
  status: AccountStatus;
  parentId: string | null;
};

async function lockLedgerAccount(transaction: Prisma.TransactionClient, context: BusinessAccessContext, accountId: string) {
  const rows = await transaction.$queryRaw<LockedAccount[]>`
    SELECT "id", "code", "name", "class", "type", "normalBalance", "kind", "isContra", "manualPostingAllowed",
      "systemKey", "systemManaged", "required", "status", "parentId"
    FROM "LedgerAccount"
    WHERE "id" = ${accountId} AND "tenantId" = ${context.tenantId} AND "businessId" = ${context.businessId}
    FOR UPDATE
  `;
  if (!rows[0]) throw new Error("LEDGER_ACCOUNT_NOT_FOUND");
  return rows[0];
}

async function validateParent(
  transaction: Prisma.TransactionClient,
  context: BusinessAccessContext,
  parentId: string | null,
  accountClass: AccountClass,
  status: AccountStatus,
) {
  if (!parentId) return;
  const rows = await transaction.$queryRaw<Array<{ id: string; class: AccountClass; kind: string; status: AccountStatus }>>`
    SELECT "id", "class", "kind", "status"
    FROM "LedgerAccount"
    WHERE "id" = ${parentId} AND "tenantId" = ${context.tenantId} AND "businessId" = ${context.businessId}
    FOR UPDATE
  `;
  const parent = rows[0];
  if (!parent) throw new Error("LEDGER_ACCOUNT_PARENT_NOT_FOUND");
  if (parent.kind !== "HEADER") throw new Error("LEDGER_ACCOUNT_PARENT_NOT_HEADER");
  if (parent.class !== accountClass) throw new Error("LEDGER_ACCOUNT_PARENT_CLASS_MISMATCH");
  if (status === "ACTIVE" && parent.status !== "ACTIVE") throw new Error("LEDGER_ACCOUNT_PARENT_INACTIVE");
}

function structuralSnapshot(account: LockedAccount) {
  return {
    class: account.class,
    type: account.type,
    normalBalance: account.normalBalance,
    kind: account.kind,
    isContra: account.isContra,
    manualPostingAllowed: account.manualPostingAllowed,
    parentId: account.parentId,
  };
}

export async function listLedgerAccounts(
  context: BusinessAccessContext,
  options: { query?: string; class?: AccountClass; status?: AccountStatus } = {},
) {
  await requireAccounting(context, "accounting.view");
  const query = options.query?.trim();
  return db.ledgerAccount.findMany({
    where: {
      tenantId: context.tenantId,
      businessId: context.businessId,
      ...(query ? { OR: [{ code: { contains: query.toUpperCase() } }, { name: { contains: query, mode: "insensitive" } }] } : {}),
      ...(options.class ? { class: options.class } : {}),
      ...(options.status ? { status: options.status } : {}),
    },
    include: {
      parent: { select: { id: true, code: true, name: true } },
      _count: { select: { children: true } },
    },
    orderBy: [{ code: "asc" }, { name: "asc" }],
    take: 500,
  });
}

export async function getLedgerAccount(context: BusinessAccessContext, accountId: string) {
  await requireAccounting(context, "accounting.view");
  const account = await db.ledgerAccount.findFirst({
    where: { id: accountId, tenantId: context.tenantId, businessId: context.businessId },
    include: {
      parent: { select: { id: true, code: true, name: true, status: true } },
      children: { orderBy: { code: "asc" }, select: { id: true, code: true, name: true, status: true } },
    },
  });
  if (!account) throw new Error("LEDGER_ACCOUNT_NOT_FOUND");
  return account;
}

export async function createLedgerAccount(context: BusinessAccessContext, rawInput: CreateLedgerAccountInput) {
  await requireAccounting(context, "accounting.manage");
  const input = createLedgerAccountSchema.parse(rawInput);
  return db.$transaction(async (transaction) => {
    await validateParent(transaction, context, input.parentId, input.class, "ACTIVE");
    const account = await transaction.ledgerAccount.create({
      data: {
        tenantId: context.tenantId,
        businessId: context.businessId,
        code: input.code,
        name: input.name,
        description: input.description,
        class: input.class,
        type: input.type,
        normalBalance: input.normalBalance,
        kind: input.kind,
        isContra: input.isContra,
        manualPostingAllowed: input.manualPostingAllowed,
        parentId: input.parentId,
      },
      include: { parent: { select: { id: true, code: true, name: true } } },
    });
    await appendAuditEvent({
      transaction,
      context,
      eventType: "LEDGER_ACCOUNT_CREATED",
      entityType: "LEDGER_ACCOUNT",
      entityId: account.id,
      summary: `Ledger account ${account.code} created`,
      metadata: {
        code: account.code,
        name: account.name,
        class: account.class,
        type: account.type,
        normalBalance: account.normalBalance,
        kind: account.kind,
        isContra: account.isContra,
        manualPostingAllowed: account.manualPostingAllowed,
        parentId: account.parentId,
      },
    });
    return account;
  });
}

export async function updateLedgerAccount(
  context: BusinessAccessContext,
  accountId: string,
  rawInput: UpdateLedgerAccountInput,
) {
  await requireAccounting(context, "accounting.manage");
  const input = updateLedgerAccountSchema.parse(rawInput);
  return db.$transaction(async (transaction) => {
    const current = await lockLedgerAccount(transaction, context, accountId);
    if (current.systemManaged) {
      const incoming = {
        class: input.class,
        type: input.type,
        normalBalance: input.normalBalance,
        kind: input.kind,
        isContra: input.isContra,
        manualPostingAllowed: input.manualPostingAllowed,
        parentId: input.parentId,
      };
      if (JSON.stringify(incoming) !== JSON.stringify(structuralSnapshot(current))) {
        throw new Error("LEDGER_ACCOUNT_SYSTEM_STRUCTURE_IMMUTABLE");
      }
    }
    await validateParent(transaction, context, input.parentId, input.class, current.status);
    const account = await transaction.ledgerAccount.update({
      where: { id: accountId },
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        class: input.class,
        type: input.type,
        normalBalance: input.normalBalance,
        kind: input.kind,
        isContra: input.isContra,
        manualPostingAllowed: input.manualPostingAllowed,
        parentId: input.parentId,
      },
      include: { parent: { select: { id: true, code: true, name: true } } },
    });
    await appendAuditEvent({
      transaction,
      context,
      eventType: "LEDGER_ACCOUNT_UPDATED",
      entityType: "LEDGER_ACCOUNT",
      entityId: account.id,
      summary: `Ledger account ${account.code} updated`,
      metadata: {
        previous: { code: current.code, name: current.name, ...structuralSnapshot(current) },
        current: {
          code: account.code,
          name: account.name,
          class: account.class,
          type: account.type,
          normalBalance: account.normalBalance,
          kind: account.kind,
          isContra: account.isContra,
          manualPostingAllowed: account.manualPostingAllowed,
          parentId: account.parentId,
        },
      },
    });
    return account;
  });
}

export async function setLedgerAccountStatus(context: BusinessAccessContext, accountId: string, rawInput: unknown) {
  await requireAccounting(context, "accounting.manage");
  const { status } = ledgerAccountStatusSchema.parse(rawInput);
  return db.$transaction(async (transaction) => {
    const current = await lockLedgerAccount(transaction, context, accountId);
    if (current.status === status) return transaction.ledgerAccount.findUniqueOrThrow({ where: { id: accountId } });
    if (status === "INACTIVE" && current.required) throw new Error("LEDGER_ACCOUNT_REQUIRED");
    if (status === "INACTIVE") {
      const activeChildren = await transaction.ledgerAccount.count({
        where: { tenantId: context.tenantId, businessId: context.businessId, parentId: accountId, status: "ACTIVE" },
      });
      if (activeChildren > 0) throw new Error("LEDGER_ACCOUNT_ACTIVE_CHILDREN");
    } else {
      await validateParent(transaction, context, current.parentId, current.class, status);
    }
    const account = await transaction.ledgerAccount.update({ where: { id: accountId }, data: { status } });
    await appendAuditEvent({
      transaction,
      context,
      eventType: "LEDGER_ACCOUNT_STATUS_CHANGED",
      entityType: "LEDGER_ACCOUNT",
      entityId: account.id,
      summary: `Ledger account ${account.code} ${status === "ACTIVE" ? "activated" : "deactivated"}`,
      metadata: { previousStatus: current.status, status },
    });
    return account;
  });
}