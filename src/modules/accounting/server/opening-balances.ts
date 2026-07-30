import { Prisma, type AccountClass, type AccountKind, type AccountStatus, type AccountType } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireBusinessCapability } from "@/modules/access/server/authorize";
import { postOpeningBalancesSchema, type PostOpeningBalancesInput } from "@/modules/accounting/contracts/opening-balances";
import { postJournalEntry } from "@/modules/accounting/server/journals";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";
import type { BusinessAccessContext } from "@/modules/tenancy/server/context";

export const openingBalanceSourceType = "OPENING_BALANCE";
export const openingBalanceSourceId = "OPENING_BALANCES";
export const openingBalanceEquitySystemKey = "OWNER_CAPITAL";
const journalMemoMaxLength = 500;
const blockedOpeningBalanceTypes = new Set<AccountType>([
  "BANK",
  "ACCOUNTS_RECEIVABLE",
  "INVENTORY",
  "VAT_INPUT",
  "ACCOUNTS_PAYABLE",
  "VAT_OUTPUT",
  "RETAINED_EARNINGS",
]);

async function requireOpeningBalanceAccess(context: BusinessAccessContext) {
  requireBusinessCapability(context, "accounting.manage");
  await requireTenantFeature(context.tenantId, "accounting.core");
}

async function requireOpeningBalanceView(context: BusinessAccessContext) {
  requireBusinessCapability(context, "accounting.view");
  await requireTenantFeature(context.tenantId, "accounting.core");
}

type OpeningBalanceAccount = {
  id: string;
  code: string;
  class: AccountClass;
  type: AccountType;
  kind: AccountKind;
  status: AccountStatus;
  systemKey: string | null;
};

export function isOpeningBalanceInputAccountEligible(account: OpeningBalanceAccount) {
  return account.status === "ACTIVE"
    && account.kind !== "HEADER"
    && account.kind !== "CONTROL"
    && account.class !== "REVENUE"
    && account.class !== "EXPENSE"
    && !blockedOpeningBalanceTypes.has(account.type)
    && account.systemKey !== openingBalanceEquitySystemKey;
}

export async function getOpeningBalanceStatus(context: BusinessAccessContext) {
  await requireOpeningBalanceView(context);
  return db.journalEntry.findFirst({
    where: {
      tenantId: context.tenantId,
      businessId: context.businessId,
      sourceType: openingBalanceSourceType,
      sourceId: openingBalanceSourceId,
      status: "POSTED",
    },
    select: {
      id: true,
      postingDate: true,
      postedAt: true,
      currencyCode: true,
      memo: true,
      lines: {
        select: { debit: true, credit: true },
      },
    },
    orderBy: { postedAt: "desc" },
  });
}

function decimal(value: string) {
  return new Prisma.Decimal(value).toDecimalPlaces(4);
}

function amount(value: Prisma.Decimal) {
  return value.toFixed(4);
}

function memoWithImportEvidence(input: ReturnType<typeof postOpeningBalancesSchema.parse>) {
  const baseMemo = input.memo ?? `Opening balances at ${input.cutoverDate}`;
  if (!input.importSummary) return baseMemo;

  const evidence = [
    `Import ${input.importSummary.fingerprint}`,
    `rows ${input.importSummary.rowCount}`,
    `debit ${input.importSummary.totalDebit}`,
    `credit ${input.importSummary.totalCredit}`,
    `net ${input.importSummary.netDifference}`,
  ].join(", ");
  const fullMemo = `${baseMemo}\n${evidence}`;
  if (fullMemo.length <= journalMemoMaxLength) return fullMemo;

  const baseLimit = journalMemoMaxLength - evidence.length - 4;
  if (baseLimit <= 0) return evidence.slice(0, journalMemoMaxLength);
  return `${baseMemo.slice(0, baseLimit)}...\n${evidence}`;
}

function validateOpeningAccount(account: OpeningBalanceAccount) {
  if (account.status !== "ACTIVE") throw new Error("OPENING_BALANCE_ACCOUNT_INACTIVE");
  if (account.kind === "HEADER") throw new Error("OPENING_BALANCE_HEADER_ACCOUNT_FORBIDDEN");
  if (account.kind === "CONTROL") throw new Error("OPENING_BALANCE_CONTROL_ACCOUNT_FORBIDDEN");
  if (account.class === "REVENUE" || account.class === "EXPENSE") throw new Error("OPENING_BALANCE_PROFIT_AND_LOSS_ACCOUNT_FORBIDDEN");
  if (blockedOpeningBalanceTypes.has(account.type)) throw new Error("OPENING_BALANCE_ACCOUNT_TYPE_FORBIDDEN");
  if (account.systemKey === openingBalanceEquitySystemKey) throw new Error("OPENING_BALANCE_BALANCING_ACCOUNT_RESERVED");
}

export async function postOpeningBalances(context: BusinessAccessContext, rawInput: PostOpeningBalancesInput) {
  await requireOpeningBalanceAccess(context);
  const input = postOpeningBalancesSchema.parse(rawInput);
  const accountIds = Array.from(new Set(input.lines.map((line) => line.accountId)));

  const [business, accounts, balancingAccount] = await Promise.all([
    db.business.findFirst({
      where: { tenantId: context.tenantId, id: context.businessId },
      select: { baseCurrency: true },
    }),
    db.ledgerAccount.findMany({
      where: { tenantId: context.tenantId, businessId: context.businessId, id: { in: accountIds } },
      select: { id: true, code: true, class: true, type: true, kind: true, status: true, systemKey: true },
    }),
    db.ledgerAccount.findFirst({
      where: { tenantId: context.tenantId, businessId: context.businessId, systemKey: openingBalanceEquitySystemKey },
      select: { id: true, code: true, class: true, type: true, kind: true, status: true, systemKey: true },
    }),
  ]);

  if (!business) throw new Error("BUSINESS_NOT_FOUND");
  if (accounts.length !== accountIds.length) throw new Error("OPENING_BALANCE_ACCOUNT_NOT_FOUND");
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  for (const line of input.lines) {
    const account = accountById.get(line.accountId);
    if (!account) throw new Error("OPENING_BALANCE_ACCOUNT_NOT_FOUND");
    validateOpeningAccount(account);
  }

  if (!balancingAccount || balancingAccount.status !== "ACTIVE" || balancingAccount.kind !== "POSTING" || balancingAccount.class !== "EQUITY") {
    throw new Error("OPENING_BALANCE_EQUITY_ACCOUNT_NOT_AVAILABLE");
  }

  const totalDebit = input.lines.reduce((sum, line) => sum.plus(decimal(line.debit)), new Prisma.Decimal(0));
  const totalCredit = input.lines.reduce((sum, line) => sum.plus(decimal(line.credit)), new Prisma.Decimal(0));
  const postingLines = input.lines.map((line) => ({
    accountId: line.accountId,
    description: line.description ?? "Opening balance",
    debit: amount(decimal(line.debit)),
    credit: amount(decimal(line.credit)),
  }));

  if (totalDebit.gt(totalCredit)) {
    postingLines.push({
      accountId: balancingAccount.id,
      description: "Opening balance equity",
      debit: "0.0000",
      credit: amount(totalDebit.minus(totalCredit)),
    });
  } else if (totalCredit.gt(totalDebit)) {
    postingLines.push({
      accountId: balancingAccount.id,
      description: "Opening balance equity",
      debit: amount(totalCredit.minus(totalDebit)),
      credit: "0.0000",
    });
  }

  return postJournalEntry(context, {
    postingDate: input.cutoverDate,
    currencyCode: business.baseCurrency,
    origin: "SYSTEM",
    sourceType: openingBalanceSourceType,
    sourceId: openingBalanceSourceId,
    idempotencyKey: input.idempotencyKey,
    memo: memoWithImportEvidence(input),
    lines: postingLines,
  });
}
