import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { createAccountingPeriod, transitionAccountingPeriod } from "../../src/modules/accounting/server/periods";
import { getJournalEntry, postJournalEntry, reverseJournalEntry } from "../../src/modules/accounting/server/journals";
import { onboardOwner } from "../../src/modules/tenancy/server/onboarding";
import { requireBusinessAccessContext } from "../../src/modules/tenancy/server/context";

async function createUser(label: string) {
  const id = randomUUID();
  return db.user.create({
    data: {
      id,
      name: label,
      email: `${label.toLowerCase().replaceAll(" ", "-")}-${id}@example.com`,
      emailVerified: true,
    },
  });
}

async function setupBusiness(label: string) {
  const owner = await createUser(`${label} Owner`);
  const onboarding = await onboardOwner({
    idempotencyKey: `journal-${label}-${randomUUID()}`,
    userId: owner.id,
    tenantName: `${label} Tenant`,
    businessLegalName: `${label} Business LLC`,
  });
  const context = await requireBusinessAccessContext({ userId: owner.id, businessId: onboarding.businessId });
  await createAccountingPeriod(context, { name: "January 2027", startDate: "2027-01-01", endDate: "2027-01-31" });
  const accounts = await db.ledgerAccount.findMany({
    where: {
      tenantId: context.tenantId,
      businessId: context.businessId,
      systemKey: { in: ["CASH_ON_HAND", "SERVICE_REVENUE", "ACCOUNTS_RECEIVABLE"] },
    },
  });
  const byKey = new Map(accounts.map((account) => [account.systemKey, account]));
  return {
    owner,
    onboarding,
    context,
    cash: byKey.get("CASH_ON_HAND")!,
    revenue: byKey.get("SERVICE_REVENUE")!,
    receivable: byKey.get("ACCOUNTS_RECEIVABLE")!,
  };
}

function posting(input: {
  key: string;
  sourceId: string;
  cashId: string;
  revenueId: string;
  amount?: string;
  origin?: "SYSTEM" | "MANUAL";
}) {
  const amount = input.amount ?? "125.5000";
  return {
    postingDate: "2027-01-15",
    currencyCode: "AED",
    origin: input.origin ?? "SYSTEM",
    sourceType: "INTEGRATION_TEST",
    sourceId: input.sourceId,
    idempotencyKey: input.key,
    memo: "Verified journal posting",
    lines: [
      { accountId: input.cashId, description: "Cash received", debit: amount, credit: "0" },
      { accountId: input.revenueId, description: "Service revenue", debit: "0", credit: amount },
    ],
  };
}

describe("central journal posting kernel", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("posts one immutable balanced entry and returns the same result for an equivalent retry", async () => {
    const setup = await setupBusiness("Balanced");
    const input = posting({ key: `balanced-${randomUUID()}`, sourceId: "service-1", cashId: setup.cash.id, revenueId: setup.revenue.id });
    const first = await postJournalEntry(setup.context, input);
    const retry = await postJournalEntry(setup.context, input);

    expect(first.id).toBe(retry.id);
    expect(first.status).toBe("POSTED");
    expect(first.lines).toHaveLength(2);
    expect(first.lines.reduce((sum, line) => sum + Number(line.debit), 0)).toBe(125.5);
    expect(first.lines.reduce((sum, line) => sum + Number(line.credit), 0)).toBe(125.5);

    await expect(db.journalEntry.update({ where: { id: first.id }, data: { memo: "Changed" } })).rejects.toThrow();
    await expect(db.journalLine.update({ where: { id: first.lines[0]!.id }, data: { debit: "126" } })).rejects.toThrow();
    expect((await getJournalEntry(setup.context, first.id)).id).toBe(first.id);
  });

  it("rejects changed retries, duplicate sources, unbalanced input, and pending commits", async () => {
    const setup = await setupBusiness("Retry");
    const key = `retry-${randomUUID()}`;
    await postJournalEntry(setup.context, posting({ key, sourceId: "service-2", cashId: setup.cash.id, revenueId: setup.revenue.id }));

    await expect(postJournalEntry(setup.context, posting({ key, sourceId: "service-2", cashId: setup.cash.id, revenueId: setup.revenue.id, amount: "126" }))).rejects.toThrow("JOURNAL_ENTRY_IDEMPOTENCY_CONFLICT");
    await expect(postJournalEntry(setup.context, posting({ key: `other-${randomUUID()}`, sourceId: "service-2", cashId: setup.cash.id, revenueId: setup.revenue.id }))).rejects.toThrow("JOURNAL_ENTRY_SOURCE_ALREADY_POSTED");

    const unbalanced = posting({ key: `unbalanced-${randomUUID()}`, sourceId: "service-3", cashId: setup.cash.id, revenueId: setup.revenue.id });
    await expect(postJournalEntry(setup.context, {
      ...unbalanced,
      lines: [unbalanced.lines[0], { ...unbalanced.lines[1], credit: "124.5000" }],
    })).rejects.toThrow("JOURNAL_ENTRY_UNBALANCED");

    await expect(db.journalEntry.create({
      data: {
        tenantId: setup.context.tenantId,
        businessId: setup.context.businessId,
        postingDate: new Date("2027-01-15T00:00:00.000Z"),
        currencyCode: "AED",
        origin: "SYSTEM",
        sourceType: "DIRECT_PENDING",
        sourceId: randomUUID(),
        idempotencyKey: `pending-${randomUUID()}`,
        payloadHash: "a".repeat(64),
        createdById: setup.owner.id,
      },
    })).rejects.toThrow();
  });

  it("enforces period, currency, tenant, account-state, and manual control-account policies", async () => {
    const first = await setupBusiness("Policy First");
    const second = await setupBusiness("Policy Second");

    await expect(postJournalEntry(first.context, {
      ...posting({ key: `currency-${randomUUID()}`, sourceId: "currency", cashId: first.cash.id, revenueId: first.revenue.id }),
      currencyCode: "USD",
    })).rejects.toThrow("JOURNAL_ENTRY_BASE_CURRENCY_REQUIRED");

    await expect(postJournalEntry(first.context, posting({ key: `scope-${randomUUID()}`, sourceId: "scope", cashId: second.cash.id, revenueId: first.revenue.id }))).rejects.toThrow("JOURNAL_ENTRY_ACCOUNT_NOT_FOUND");

    await db.ledgerAccount.update({ where: { id: first.cash.id }, data: { status: "INACTIVE" } });
    await expect(postJournalEntry(first.context, posting({ key: `inactive-${randomUUID()}`, sourceId: "inactive", cashId: first.cash.id, revenueId: first.revenue.id }))).rejects.toThrow("JOURNAL_ENTRY_ACCOUNT_INACTIVE");
    await db.ledgerAccount.update({ where: { id: first.cash.id }, data: { status: "ACTIVE" } });

    await expect(postJournalEntry(first.context, posting({ key: `manual-${randomUUID()}`, sourceId: "manual", cashId: first.receivable.id, revenueId: first.revenue.id, origin: "MANUAL" }))).rejects.toThrow("JOURNAL_ENTRY_MANUAL_ACCOUNT_FORBIDDEN");

    const period = await db.accountingPeriod.findFirstOrThrow({ where: { tenantId: first.context.tenantId, businessId: first.context.businessId } });
    await transitionAccountingPeriod(first.context, period.id, { status: "CLOSED", reason: "January close completed" });
    await expect(postJournalEntry(first.context, posting({ key: `closed-${randomUUID()}`, sourceId: "closed", cashId: first.cash.id, revenueId: first.revenue.id }))).rejects.toThrow("ACCOUNTING_PERIOD_CLOSED");
  });

  it("creates one exact opposite linked reversal and rejects reversal chains", async () => {
    const setup = await setupBusiness("Reversal");
    const original = await postJournalEntry(setup.context, posting({ key: `original-${randomUUID()}`, sourceId: "service-4", cashId: setup.cash.id, revenueId: setup.revenue.id }));
    const reversalKey = `reversal-${randomUUID()}`;
    const reversal = await reverseJournalEntry(setup.context, original.id, {
      postingDate: "2027-01-20",
      idempotencyKey: reversalKey,
      reason: "Customer transaction cancelled",
    });
    const retry = await reverseJournalEntry(setup.context, original.id, {
      postingDate: "2027-01-20",
      idempotencyKey: reversalKey,
      reason: "Customer transaction cancelled",
    });

    expect(reversal.id).toBe(retry.id);
    expect(reversal.reversalOfId).toBe(original.id);
    expect(reversal.origin).toBe("REVERSAL");
    expect(Number(reversal.lines[0]!.credit)).toBe(Number(original.lines[0]!.debit));
    expect(Number(reversal.lines[1]!.debit)).toBe(Number(original.lines[1]!.credit));
    await expect(reverseJournalEntry(setup.context, reversal.id, {
      postingDate: "2027-01-21",
      idempotencyKey: `chain-${randomUUID()}`,
      reason: "Invalid reversal chain",
    })).rejects.toThrow("JOURNAL_REVERSAL_CHAIN_FORBIDDEN");
  });

  it("serializes concurrent retries into one posted entry", async () => {
    const setup = await setupBusiness("Concurrency");
    const input = posting({ key: `concurrent-${randomUUID()}`, sourceId: "service-5", cashId: setup.cash.id, revenueId: setup.revenue.id });
    const results = await Promise.all([postJournalEntry(setup.context, input), postJournalEntry(setup.context, input)]);
    expect(new Set(results.map((entry) => entry.id)).size).toBe(1);
    expect(await db.journalEntry.count({ where: { tenantId: setup.context.tenantId, businessId: setup.context.businessId, sourceId: "service-5" } })).toBe(1);
  });
});
