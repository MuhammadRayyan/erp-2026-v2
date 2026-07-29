import { createHash } from "node:crypto";
import { Prisma, type JournalEntryOrigin } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireBusinessCapability } from "@/modules/access/server/authorize";
import { appendAuditEvent } from "@/modules/audit/server/audit";
import {
  postJournalEntrySchema,
  reverseJournalEntrySchema,
  type PostJournalEntryInput,
  type ReverseJournalEntryInput,
} from "@/modules/accounting/contracts/journals";
import { assertAccountingDateOpen } from "@/modules/accounting/server/periods";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";
import type { BusinessAccessContext } from "@/modules/tenancy/server/context";

async function requireAccounting(context: BusinessAccessContext, capability: "accounting.view" | "accounting.manage") {
  requireBusinessCapability(context, capability);
  await requireTenantFeature(context.tenantId, "accounting.core");
}

type NormalizedLine = {
  accountId: string;
  description: string | null;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
};

type NormalizedPosting = {
  postingDate: Date;
  currencyCode: string;
  origin: JournalEntryOrigin;
  sourceType: string;
  sourceId: string;
  idempotencyKey: string;
  memo: string | null;
  reversalOfId: string | null;
  lines: NormalizedLine[];
};

type LockedAccount = {
  id: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
  kind: "HEADER" | "POSTING" | "CONTROL";
  manualPostingAllowed: boolean;
};

const zero = new Prisma.Decimal(0);

function accountingDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function normalizeAmount(value: string) {
  return new Prisma.Decimal(value).toDecimalPlaces(4);
}

function normalizedPayload(posting: NormalizedPosting) {
  return {
    postingDate: posting.postingDate.toISOString().slice(0, 10),
    currencyCode: posting.currencyCode,
    origin: posting.origin,
    sourceType: posting.sourceType,
    sourceId: posting.sourceId,
    memo: posting.memo,
    reversalOfId: posting.reversalOfId,
    lines: posting.lines.map((line, index) => ({
      lineNumber: index + 1,
      accountId: line.accountId,
      description: line.description,
      debit: line.debit.toFixed(4),
      credit: line.credit.toFixed(4),
    })),
  };
}

function payloadHash(posting: NormalizedPosting) {
  return createHash("sha256").update(JSON.stringify(normalizedPayload(posting))).digest("hex");
}

function normalizePosting(input: ReturnType<typeof postJournalEntrySchema.parse>): NormalizedPosting {
  return {
    postingDate: accountingDate(input.postingDate),
    currencyCode: input.currencyCode,
    origin: input.origin,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    idempotencyKey: input.idempotencyKey,
    memo: input.memo,
    reversalOfId: null,
    lines: input.lines.map((line) => ({
      accountId: line.accountId,
      description: line.description,
      debit: normalizeAmount(line.debit),
      credit: normalizeAmount(line.credit),
    })),
  };
}

async function acquirePostingLocks(
  transaction: Prisma.TransactionClient,
  context: Pick<BusinessAccessContext, "tenantId" | "businessId">,
  posting: NormalizedPosting,
) {
  const keys = [
    `journal-idempotency:${context.tenantId}:${context.businessId}:${posting.idempotencyKey}`,
    `journal-source:${context.tenantId}:${context.businessId}:${posting.sourceType}:${posting.sourceId}`,
  ].sort();
  for (const key of keys) {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
  }
}

async function validatePostingAccounts(
  transaction: Prisma.TransactionClient,
  context: Pick<BusinessAccessContext, "tenantId" | "businessId">,
  posting: NormalizedPosting,
) {
  const accountIds = Array.from(new Set(posting.lines.map((line) => line.accountId)));
  const accounts = await transaction.$queryRaw<LockedAccount[]>(Prisma.sql`
    SELECT "id", "code", "status", "kind", "manualPostingAllowed"
    FROM "LedgerAccount"
    WHERE "tenantId" = ${context.tenantId}
      AND "businessId" = ${context.businessId}
      AND "id" IN (${Prisma.join(accountIds)})
    ORDER BY "id"
    FOR SHARE
  `);
  if (accounts.length !== accountIds.length) throw new Error("JOURNAL_ENTRY_ACCOUNT_NOT_FOUND");

  for (const account of accounts) {
    if (account.status !== "ACTIVE") throw new Error("JOURNAL_ENTRY_ACCOUNT_INACTIVE");
    if (account.kind === "HEADER") throw new Error("JOURNAL_ENTRY_HEADER_ACCOUNT");
    if (posting.origin === "MANUAL" && (account.kind !== "POSTING" || !account.manualPostingAllowed)) {
      throw new Error("JOURNAL_ENTRY_MANUAL_ACCOUNT_FORBIDDEN");
    }
  }
}

async function postWithinTransaction(
  transaction: Prisma.TransactionClient,
  context: BusinessAccessContext,
  posting: NormalizedPosting,
) {
  await acquirePostingLocks(transaction, context, posting);
  const hash = payloadHash(posting);

  const existing = await transaction.journalEntry.findFirst({
    where: {
      tenantId: context.tenantId,
      businessId: context.businessId,
      idempotencyKey: posting.idempotencyKey,
    },
    include: { lines: { orderBy: { lineNumber: "asc" } } },
  });
  if (existing) {
    if (existing.payloadHash !== hash) throw new Error("JOURNAL_ENTRY_IDEMPOTENCY_CONFLICT");
    return existing;
  }

  const sourceExists = await transaction.journalEntry.findFirst({
    where: {
      tenantId: context.tenantId,
      businessId: context.businessId,
      sourceType: posting.sourceType,
      sourceId: posting.sourceId,
    },
    select: { id: true },
  });
  if (sourceExists) throw new Error("JOURNAL_ENTRY_SOURCE_ALREADY_POSTED");

  const totalDebit = posting.lines.reduce((sum, line) => sum.plus(line.debit), zero);
  const totalCredit = posting.lines.reduce((sum, line) => sum.plus(line.credit), zero);
  if (totalDebit.lte(0) || !totalDebit.equals(totalCredit)) throw new Error("JOURNAL_ENTRY_UNBALANCED");

  const businessRows = await transaction.$queryRaw<Array<{ baseCurrency: string }>>`
    SELECT "baseCurrency"
    FROM "Business"
    WHERE "tenantId" = ${context.tenantId} AND "id" = ${context.businessId}
    FOR SHARE
  `;
  const business = businessRows[0];
  if (!business) throw new Error("BUSINESS_NOT_FOUND");
  if (posting.currencyCode !== business.baseCurrency) throw new Error("JOURNAL_ENTRY_BASE_CURRENCY_REQUIRED");

  await assertAccountingDateOpen(transaction, context, posting.postingDate);
  await validatePostingAccounts(transaction, context, posting);

  const entry = await transaction.journalEntry.create({
    data: {
      tenantId: context.tenantId,
      businessId: context.businessId,
      postingDate: posting.postingDate,
      currencyCode: posting.currencyCode,
      origin: posting.origin,
      sourceType: posting.sourceType,
      sourceId: posting.sourceId,
      idempotencyKey: posting.idempotencyKey,
      payloadHash: hash,
      memo: posting.memo,
      reversalOfId: posting.reversalOfId,
      createdById: context.userId,
    },
  });

  await transaction.journalLine.createMany({
    data: posting.lines.map((line, index) => ({
      tenantId: context.tenantId,
      businessId: context.businessId,
      journalEntryId: entry.id,
      lineNumber: index + 1,
      accountId: line.accountId,
      description: line.description,
      debit: line.debit,
      credit: line.credit,
    })),
  });

  const posted = await transaction.journalEntry.update({
    where: { id: entry.id },
    data: { status: "POSTED", postedAt: new Date() },
    include: { lines: { orderBy: { lineNumber: "asc" } } },
  });

  await appendAuditEvent({
    transaction,
    context,
    eventType: posting.origin === "REVERSAL" ? "JOURNAL_ENTRY_REVERSED" : "JOURNAL_ENTRY_POSTED",
    entityType: "JOURNAL_ENTRY",
    entityId: posted.id,
    summary: posting.origin === "REVERSAL" ? `Journal entry ${posting.reversalOfId} reversed` : `Journal entry ${posted.sourceType}/${posted.sourceId} posted`,
    metadata: {
      postingDate: posted.postingDate.toISOString().slice(0, 10),
      currencyCode: posted.currencyCode,
      origin: posted.origin,
      sourceType: posted.sourceType,
      sourceId: posted.sourceId,
      reversalOfId: posted.reversalOfId,
      totalDebit: totalDebit.toFixed(4),
      totalCredit: totalCredit.toFixed(4),
      lineCount: posted.lines.length,
    },
  });

  return posted;
}

export async function postJournalEntry(context: BusinessAccessContext, rawInput: PostJournalEntryInput) {
  await requireAccounting(context, "accounting.manage");
  const posting = normalizePosting(postJournalEntrySchema.parse(rawInput));
  return db.$transaction(
    (transaction) => postWithinTransaction(transaction, context, posting),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function reverseJournalEntry(
  context: BusinessAccessContext,
  journalEntryId: string,
  rawInput: ReverseJournalEntryInput,
) {
  await requireAccounting(context, "accounting.manage");
  const input = reverseJournalEntrySchema.parse(rawInput);

  return db.$transaction(async (transaction) => {
    const originals = await transaction.$queryRaw<Array<{
      id: string;
      postingDate: Date;
      currencyCode: string;
      status: "PENDING" | "POSTED";
      origin: JournalEntryOrigin;
    }>>`
      SELECT "id", "postingDate", "currencyCode", "status", "origin"
      FROM "JournalEntry"
      WHERE "id" = ${journalEntryId}
        AND "tenantId" = ${context.tenantId}
        AND "businessId" = ${context.businessId}
      FOR UPDATE
    `;
    const original = originals[0];
    if (!original) throw new Error("JOURNAL_ENTRY_NOT_FOUND");
    if (original.status !== "POSTED") throw new Error("JOURNAL_REVERSAL_ORIGINAL_NOT_POSTED");
    if (original.origin === "REVERSAL") throw new Error("JOURNAL_REVERSAL_CHAIN_FORBIDDEN");

    const alreadyReversed = await transaction.journalEntry.findFirst({
      where: { tenantId: context.tenantId, businessId: context.businessId, reversalOfId: original.id },
      include: { lines: { orderBy: { lineNumber: "asc" } } },
    });
    if (alreadyReversed) {
      if (alreadyReversed.idempotencyKey !== input.idempotencyKey) throw new Error("JOURNAL_ENTRY_ALREADY_REVERSED");
      return alreadyReversed;
    }

    const lines = await transaction.journalLine.findMany({
      where: { tenantId: context.tenantId, businessId: context.businessId, journalEntryId: original.id },
      orderBy: { lineNumber: "asc" },
    });
    const posting: NormalizedPosting = {
      postingDate: accountingDate(input.postingDate),
      currencyCode: original.currencyCode,
      origin: "REVERSAL",
      sourceType: "JOURNAL_REVERSAL",
      sourceId: original.id,
      idempotencyKey: input.idempotencyKey,
      memo: input.reason,
      reversalOfId: original.id,
      lines: lines.map((line) => ({
        accountId: line.accountId,
        description: line.description,
        debit: line.credit,
        credit: line.debit,
      })),
    };
    return postWithinTransaction(transaction, context, posting);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listJournalEntries(context: BusinessAccessContext) {
  await requireAccounting(context, "accounting.view");
  return db.journalEntry.findMany({
    where: { tenantId: context.tenantId, businessId: context.businessId, status: "POSTED" },
    include: { lines: { orderBy: { lineNumber: "asc" }, include: { account: { select: { code: true, name: true } } } } },
    orderBy: [{ postingDate: "desc" }, { postedAt: "desc" }],
    take: 500,
  });
}

export async function getJournalEntry(context: BusinessAccessContext, journalEntryId: string) {
  await requireAccounting(context, "accounting.view");
  const entry = await db.journalEntry.findFirst({
    where: { id: journalEntryId, tenantId: context.tenantId, businessId: context.businessId, status: "POSTED" },
    include: {
      lines: { orderBy: { lineNumber: "asc" }, include: { account: { select: { code: true, name: true } } } },
      reversedBy: { select: { id: true, postingDate: true, postedAt: true } },
      reversalOf: { select: { id: true, postingDate: true, postedAt: true } },
    },
  });
  if (!entry) throw new Error("JOURNAL_ENTRY_NOT_FOUND");
  return entry;
}
