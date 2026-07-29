import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { MembershipStatus } from "../../src/generated/prisma/client";
import { db } from "../../src/lib/db";
import type { CreateLedgerAccountInput } from "../../src/modules/accounting/contracts/accounts";
import { defaultChartOfAccounts } from "../../src/modules/accounting/default-chart";
import {
  createLedgerAccount,
  getLedgerAccount,
  listLedgerAccounts,
  setLedgerAccountStatus,
  updateLedgerAccount,
} from "../../src/modules/accounting/server/accounts";
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

async function setupBusiness(label = "Accounting") {
  const owner = await createUser(`${label} Owner`);
  const onboarding = await onboardOwner({
    idempotencyKey: `accounting-${label}-${randomUUID()}`,
    userId: owner.id,
    tenantName: `${label} Tenant`,
    businessLegalName: `${label} Business LLC`,
  });
  const context = await requireBusinessAccessContext({ userId: owner.id, businessId: onboarding.businessId });
  return { owner, onboarding, context };
}

function customAccount(overrides: Partial<CreateLedgerAccountInput> = {}): CreateLedgerAccountInput {
  return {
    code: "7010",
    name: "Marketing Expense",
    description: "Custom operating expense",
    class: "EXPENSE",
    type: "OPERATING_EXPENSE",
    normalBalance: "DEBIT",
    kind: "POSTING",
    isContra: false,
    manualPostingAllowed: true,
    parentId: null,
    ...overrides,
  };
}

describe("chart of accounts foundation", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("installs the complete default chart during onboarding", async () => {
    const { onboarding, context } = await setupBusiness("Defaults");
    const accounts = await listLedgerAccounts(context);
    expect(accounts).toHaveLength(defaultChartOfAccounts.length);

    const receivable = accounts.find((account) => account.systemKey === "ACCOUNTS_RECEIVABLE");
    expect(receivable).toMatchObject({
      class: "ASSET",
      type: "ACCOUNTS_RECEIVABLE",
      kind: "CONTROL",
      normalBalance: "DEBIT",
      manualPostingAllowed: false,
      required: true,
      status: "ACTIVE",
    });
    expect(receivable?.parent?.code).toBe("1100");

    const depreciation = accounts.find((account) => account.systemKey === "ACCUMULATED_DEPRECIATION");
    expect(depreciation).toMatchObject({ class: "ASSET", isContra: true, normalBalance: "CREDIT" });

    const feature = await db.featureDefinition.findUnique({ where: { key: "accounting.core" } });
    expect(feature).not.toBeNull();
    expect(await db.ledgerAccount.count({ where: { tenantId: onboarding.tenantId, businessId: onboarding.businessId } })).toBe(defaultChartOfAccounts.length);
  });

  it("creates, edits, deactivates, reactivates, and audits custom accounts", async () => {
    const { context } = await setupBusiness("Lifecycle");
    const header = await createLedgerAccount(context, customAccount({
      code: "7000",
      name: "Other Operating Expenses",
      type: "GENERAL",
      kind: "HEADER",
      manualPostingAllowed: false,
    }));
    const child = await createLedgerAccount(context, customAccount({ parentId: header.id }));
    const updated = await updateLedgerAccount(context, child.id, customAccount({
      code: "7020",
      name: "Advertising and Marketing",
      parentId: header.id,
    }));
    expect(updated).toMatchObject({ code: "7020", name: "Advertising and Marketing", parentId: header.id });

    await setLedgerAccountStatus(context, child.id, { status: "INACTIVE" });
    await setLedgerAccountStatus(context, header.id, { status: "INACTIVE" });
    await expect(setLedgerAccountStatus(context, child.id, { status: "ACTIVE" })).rejects.toThrow("LEDGER_ACCOUNT_PARENT_INACTIVE");
    await setLedgerAccountStatus(context, header.id, { status: "ACTIVE" });
    await setLedgerAccountStatus(context, child.id, { status: "ACTIVE" });

    const events = await db.auditEvent.findMany({
      where: { tenantId: context.tenantId, businessId: context.businessId, entityType: "LEDGER_ACCOUNT", entityId: { in: [header.id, child.id] } },
      orderBy: { occurredAt: "asc" },
    });
    expect(events.filter((event) => event.eventType === "LEDGER_ACCOUNT_CREATED")).toHaveLength(2);
    expect(events.some((event) => event.eventType === "LEDGER_ACCOUNT_UPDATED")).toBe(true);
    expect(events.filter((event) => event.eventType === "LEDGER_ACCOUNT_STATUS_CHANGED").length).toBeGreaterThanOrEqual(4);
  });

  it("protects required and system-managed account structure", async () => {
    const { context } = await setupBusiness("System Protection");
    const receivable = (await listLedgerAccounts(context)).find((account) => account.systemKey === "ACCOUNTS_RECEIVABLE");
    expect(receivable).toBeDefined();

    await expect(setLedgerAccountStatus(context, receivable!.id, { status: "INACTIVE" })).rejects.toThrow("LEDGER_ACCOUNT_REQUIRED");
    await expect(updateLedgerAccount(context, receivable!.id, {
      code: receivable!.code,
      name: receivable!.name,
      description: receivable!.description,
      class: receivable!.class,
      type: "CASH",
      normalBalance: receivable!.normalBalance,
      kind: "POSTING",
      isContra: receivable!.isContra,
      manualPostingAllowed: true,
      parentId: receivable!.parentId,
    })).rejects.toThrow("LEDGER_ACCOUNT_SYSTEM_STRUCTURE_IMMUTABLE");

    const renamed = await updateLedgerAccount(context, receivable!.id, {
      code: "1135",
      name: "Trade Receivables",
      description: receivable!.description,
      class: receivable!.class,
      type: receivable!.type,
      normalBalance: receivable!.normalBalance,
      kind: receivable!.kind,
      isContra: receivable!.isContra,
      manualPostingAllowed: receivable!.manualPostingAllowed,
      parentId: receivable!.parentId,
    });
    expect(renamed).toMatchObject({ code: "1135", name: "Trade Receivables", systemKey: "ACCOUNTS_RECEIVABLE" });
  });

  it("rejects invalid classifications and hierarchy choices", async () => {
    const { context } = await setupBusiness("Validation");
    await expect(createLedgerAccount(context, customAccount({ normalBalance: "CREDIT" }))).rejects.toThrow();
    await expect(createLedgerAccount(context, customAccount({ type: "ACCOUNTS_PAYABLE" }))).rejects.toThrow();
    await expect(createLedgerAccount(context, customAccount({ type: "ACCOUNTS_RECEIVABLE", kind: "POSTING" }))).rejects.toThrow();

    const assetHeader = (await listLedgerAccounts(context)).find((account) => account.systemKey === "CURRENT_ASSETS");
    await expect(createLedgerAccount(context, customAccount({ parentId: assetHeader!.id }))).rejects.toThrow("LEDGER_ACCOUNT_PARENT_CLASS_MISMATCH");

    const postingParent = (await listLedgerAccounts(context)).find((account) => account.systemKey === "CASH_ON_HAND");
    await expect(createLedgerAccount(context, customAccount({ class: "ASSET", type: "CASH", parentId: postingParent!.id }))).rejects.toThrow("LEDGER_ACCOUNT_PARENT_NOT_HEADER");
  });

  it("prevents active-child deactivation and hierarchy cycles at PostgreSQL", async () => {
    const { context } = await setupBusiness("Hierarchy");
    const first = await createLedgerAccount(context, customAccount({ code: "7000", name: "First Header", type: "GENERAL", kind: "HEADER", manualPostingAllowed: false }));
    const second = await createLedgerAccount(context, customAccount({ code: "7010", name: "Second Header", type: "GENERAL", kind: "HEADER", manualPostingAllowed: false, parentId: first.id }));
    await createLedgerAccount(context, customAccount({ code: "7020", parentId: second.id }));

    await expect(setLedgerAccountStatus(context, second.id, { status: "INACTIVE" })).rejects.toThrow("LEDGER_ACCOUNT_ACTIVE_CHILDREN");
    await expect(db.ledgerAccount.update({ where: { id: first.id }, data: { parentId: second.id } })).rejects.toThrow();
    expect((await getLedgerAccount(context, first.id)).parentId).toBeNull();
  });

  it("enforces tenant scope for parent relationships", async () => {
    const first = await setupBusiness("First Scope");
    const second = await setupBusiness("Second Scope");
    const foreignHeader = (await listLedgerAccounts(second.context)).find((account) => account.systemKey === "OPERATING_EXPENSES");

    await expect(db.ledgerAccount.create({
      data: {
        tenantId: first.context.tenantId,
        businessId: first.context.businessId,
        code: "7990",
        name: "Cross tenant account",
        class: "EXPENSE",
        type: "OPERATING_EXPENSE",
        normalBalance: "DEBIT",
        kind: "POSTING",
        isContra: false,
        manualPostingAllowed: true,
        parentId: foreignHeader!.id,
      },
    })).rejects.toThrow();
  });

  it("allows viewers to read but denies account management", async () => {
    const { onboarding, context } = await setupBusiness("RBAC");
    const viewer = await createUser("Accounting Viewer");
    await db.tenantMembership.create({ data: { tenantId: onboarding.tenantId, userId: viewer.id, status: MembershipStatus.ACTIVE } });
    await db.businessMembership.create({
      data: { tenantId: onboarding.tenantId, businessId: onboarding.businessId, userId: viewer.id, roleKey: "business.viewer", status: MembershipStatus.ACTIVE },
    });
    const viewerContext = await requireBusinessAccessContext({ userId: viewer.id, businessId: onboarding.businessId });
    expect(await listLedgerAccounts(viewerContext)).toHaveLength(defaultChartOfAccounts.length);
    await expect(createLedgerAccount(viewerContext, customAccount())).rejects.toThrow("BUSINESS_CAPABILITY_DENIED");
    expect(await listLedgerAccounts(context)).toHaveLength(defaultChartOfAccounts.length);
  });

  it("enforces the accounting feature entitlement", async () => {
    const { onboarding, context } = await setupBusiness("Entitlement");
    const feature = await db.featureDefinition.findUniqueOrThrow({ where: { key: "accounting.core" } });
    await db.tenantEntitlementOverride.create({
      data: { tenantId: onboarding.tenantId, featureId: feature.id, enabled: false, unlimited: false, reason: "integration test" },
    });
    await expect(listLedgerAccounts(context)).rejects.toThrow("TENANT_FEATURE_DISABLED");
    await expect(createLedgerAccount(context, customAccount())).rejects.toThrow("TENANT_FEATURE_DISABLED");
  });
});