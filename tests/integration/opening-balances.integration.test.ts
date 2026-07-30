import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { createAccountingPeriod } from "../../src/modules/accounting/server/periods";
import { postOpeningBalances } from "../../src/modules/accounting/server/opening-balances";
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
    idempotencyKey: `opening-${label}-${randomUUID()}`,
    userId: owner.id,
    tenantName: `${label} Tenant`,
    businessLegalName: `${label} Business LLC`,
  });
  const context = await requireBusinessAccessContext({ userId: owner.id, businessId: onboarding.businessId });
  await createAccountingPeriod(context, { name: "Opening 2027", startDate: "2027-01-01", endDate: "2027-01-31" });
  const accounts = await db.ledgerAccount.findMany({
    where: {
      tenantId: context.tenantId,
      businessId: context.businessId,
      systemKey: { in: ["CASH_ON_HAND", "LOANS_PAYABLE", "OWNER_CAPITAL", "ACCOUNTS_RECEIVABLE", "BANK_ACCOUNT", "SERVICE_REVENUE"] },
    },
  });
  const byKey = new Map(accounts.map((account) => [account.systemKey, account]));
  return {
    context,
    cash: byKey.get("CASH_ON_HAND")!,
    loan: byKey.get("LOANS_PAYABLE")!,
    ownerCapital: byKey.get("OWNER_CAPITAL")!,
    receivable: byKey.get("ACCOUNTS_RECEIVABLE")!,
    bank: byKey.get("BANK_ACCOUNT")!,
    revenue: byKey.get("SERVICE_REVENUE")!,
  };
}

describe("controlled opening balance posting", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("posts one idempotent opening set and balances the net amount to owner capital", async () => {
    const setup = await setupBusiness("Opening Balanced");
    const input = {
      cutoverDate: "2027-01-01",
      idempotencyKey: `opening-balanced-${randomUUID()}`,
      memo: "Owner-approved opening balances",
      lines: [
        { accountId: setup.cash.id, description: "Cash counted at cutover", debit: "100.0000", credit: "0" },
        { accountId: setup.loan.id, description: "Loan outstanding at cutover", debit: "0", credit: "30.0000" },
      ],
    };

    const first = await postOpeningBalances(setup.context, input);
    const retry = await postOpeningBalances(setup.context, input);
    expect(first.id).toBe(retry.id);
    expect(first.sourceType).toBe("OPENING_BALANCE");
    expect(first.sourceId).toBe("OPENING_BALANCES");
    expect(first.postingDate.toISOString().slice(0, 10)).toBe("2027-01-01");
    expect(first.lines).toHaveLength(3);
    expect(first.lines.reduce((sum, line) => sum + Number(line.debit), 0)).toBe(100);
    expect(first.lines.reduce((sum, line) => sum + Number(line.credit), 0)).toBe(100);

    const balancingLine = first.lines.find((line) => line.accountId === setup.ownerCapital.id);
    expect(balancingLine).toBeTruthy();
    expect(Number(balancingLine?.credit)).toBe(70);
    expect(Number(balancingLine?.debit)).toBe(0);
  });

  it("rejects conflicting duplicate opening sets for the same business", async () => {
    const setup = await setupBusiness("Opening Duplicate");
    await postOpeningBalances(setup.context, {
      cutoverDate: "2027-01-01",
      idempotencyKey: `opening-original-${randomUUID()}`,
      memo: null,
      lines: [{ accountId: setup.cash.id, description: null, debit: "25.0000", credit: "0" }],
    });

    await expect(postOpeningBalances(setup.context, {
      cutoverDate: "2027-01-01",
      idempotencyKey: `opening-conflict-${randomUUID()}`,
      memo: null,
      lines: [{ accountId: setup.cash.id, description: null, debit: "30.0000", credit: "0" }],
    })).rejects.toThrow("JOURNAL_ENTRY_SOURCE_ALREADY_POSTED");
  });

  it("blocks unsupported control, bank, and profit-and-loss shortcuts", async () => {
    const setup = await setupBusiness("Opening Policy");

    await expect(postOpeningBalances(setup.context, {
      cutoverDate: "2027-01-01",
      idempotencyKey: `opening-control-${randomUUID()}`,
      memo: null,
      lines: [{ accountId: setup.receivable.id, description: null, debit: "10.0000", credit: "0" }],
    })).rejects.toThrow("OPENING_BALANCE_CONTROL_ACCOUNT_FORBIDDEN");

    await expect(postOpeningBalances(setup.context, {
      cutoverDate: "2027-01-01",
      idempotencyKey: `opening-bank-${randomUUID()}`,
      memo: null,
      lines: [{ accountId: setup.bank.id, description: null, debit: "10.0000", credit: "0" }],
    })).rejects.toThrow("OPENING_BALANCE_ACCOUNT_TYPE_FORBIDDEN");

    await expect(postOpeningBalances(setup.context, {
      cutoverDate: "2027-01-01",
      idempotencyKey: `opening-revenue-${randomUUID()}`,
      memo: null,
      lines: [{ accountId: setup.revenue.id, description: null, debit: "0", credit: "10.0000" }],
    })).rejects.toThrow("OPENING_BALANCE_PROFIT_AND_LOSS_ACCOUNT_FORBIDDEN");
  });
});
