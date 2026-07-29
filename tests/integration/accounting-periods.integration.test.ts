import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { MembershipStatus } from "../../src/generated/prisma/client";
import { db } from "../../src/lib/db";
import {
  assertAccountingDateOpen,
  createAccountingPeriod,
  getAccountingPeriod,
  listAccountingPeriods,
  transitionAccountingPeriod,
  updateAccountingPeriod,
} from "../../src/modules/accounting/server/periods";
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

async function setupBusiness(label = "Periods") {
  const owner = await createUser(`${label} Owner`);
  const onboarding = await onboardOwner({
    idempotencyKey: `periods-${label}-${randomUUID()}`,
    userId: owner.id,
    tenantName: `${label} Tenant`,
    businessLegalName: `${label} Business LLC`,
  });
  const context = await requireBusinessAccessContext({ userId: owner.id, businessId: onboarding.businessId });
  return { owner, onboarding, context };
}

function period(name: string, startDate: string, endDate: string) {
  return { name, startDate, endDate };
}

describe("accounting periods and locks", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("creates, edits, lists, transitions, reopens, and audits periods", async () => {
    const { context } = await setupBusiness("Lifecycle");
    const created = await createAccountingPeriod(context, period("January 2027", "2027-01-01", "2027-01-31"));
    expect(created.status).toBe("OPEN");

    const updated = await updateAccountingPeriod(context, created.id, period("January close", "2027-01-01", "2027-01-31"));
    expect(updated.name).toBe("January close");
    expect(await listAccountingPeriods(context)).toHaveLength(1);

    const softLocked = await transitionAccountingPeriod(context, created.id, { status: "SOFT_LOCKED", reason: "Review in progress" });
    expect(softLocked).toMatchObject({ status: "SOFT_LOCKED", statusReason: "Review in progress" });
    await expect(updateAccountingPeriod(context, created.id, period("Changed", "2027-01-01", "2027-01-31"))).rejects.toThrow("ACCOUNTING_PERIOD_DATES_LOCKED");

    const closed = await transitionAccountingPeriod(context, created.id, { status: "CLOSED", reason: "Month-end review completed" });
    expect(closed.status).toBe("CLOSED");
    const reopened = await transitionAccountingPeriod(context, created.id, { status: "OPEN", reason: "Approved correction required" });
    expect(reopened).toMatchObject({ status: "OPEN", statusReason: "Approved correction required" });

    const events = await db.auditEvent.findMany({
      where: { tenantId: context.tenantId, businessId: context.businessId, entityType: "ACCOUNTING_PERIOD", entityId: created.id },
      orderBy: { occurredAt: "asc" },
    });
    expect(events.map((event) => event.eventType)).toEqual([
      "ACCOUNTING_PERIOD_CREATED",
      "ACCOUNTING_PERIOD_UPDATED",
      "ACCOUNTING_PERIOD_STATUS_CHANGED",
      "ACCOUNTING_PERIOD_STATUS_CHANGED",
      "ACCOUNTING_PERIOD_STATUS_CHANGED",
    ]);
  });

  it("rejects overlaps, fiscal-year crossings, invalid transitions, and direct deletion", async () => {
    const { context } = await setupBusiness("Protection");
    const january = await createAccountingPeriod(context, period("January 2027", "2027-01-01", "2027-01-31"));
    await expect(createAccountingPeriod(context, period("Overlap", "2027-01-15", "2027-02-15"))).rejects.toThrow("ACCOUNTING_PERIOD_OVERLAP");
    await expect(createAccountingPeriod(context, period("Cross year", "2027-12-01", "2028-01-31"))).rejects.toThrow("ACCOUNTING_PERIOD_FISCAL_YEAR_BOUNDARY");

    await transitionAccountingPeriod(context, january.id, { status: "CLOSED", reason: "Period complete" });
    await expect(transitionAccountingPeriod(context, january.id, { status: "SOFT_LOCKED", reason: "Invalid backwards transition" })).rejects.toThrow("ACCOUNTING_PERIOD_TRANSITION_INVALID");
    await expect(db.accountingPeriod.delete({ where: { id: january.id } })).rejects.toThrow();
    expect((await getAccountingPeriod(context, january.id)).status).toBe("CLOSED");
  });

  it("serializes concurrent overlapping creates", async () => {
    const { context } = await setupBusiness("Concurrency");
    const results = await Promise.allSettled([
      createAccountingPeriod(context, period("First", "2027-04-01", "2027-04-30")),
      createAccountingPeriod(context, period("Second", "2027-04-15", "2027-05-15")),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await listAccountingPeriods(context)).toHaveLength(1);
  });

  it("respects a non-calendar fiscal year", async () => {
    const { onboarding, context } = await setupBusiness("Fiscal");
    await db.businessProfile.update({ where: { businessId: onboarding.businessId }, data: { fiscalYearStartMonth: 4 } });
    await createAccountingPeriod(context, period("FY 2026-27", "2026-04-01", "2027-03-31"));
    await expect(createAccountingPeriod(context, period("Cross fiscal year", "2027-03-01", "2027-04-30"))).rejects.toThrow();
  });

  it("provides an authoritative posting-date guard", async () => {
    const { context } = await setupBusiness("Posting Guard");
    const open = await createAccountingPeriod(context, period("January 2027", "2027-01-01", "2027-01-31"));

    const allowed = await db.$transaction((transaction) => assertAccountingDateOpen(transaction, context, new Date("2027-01-15T00:00:00.000Z")));
    expect(allowed.id).toBe(open.id);
    await expect(db.$transaction((transaction) => assertAccountingDateOpen(transaction, context, new Date("2027-02-15T00:00:00.000Z")))).rejects.toThrow("ACCOUNTING_PERIOD_NOT_FOUND_FOR_DATE");

    await transitionAccountingPeriod(context, open.id, { status: "SOFT_LOCKED", reason: "Review in progress" });
    await expect(db.$transaction((transaction) => assertAccountingDateOpen(transaction, context, new Date("2027-01-15T00:00:00.000Z")))).rejects.toThrow("ACCOUNTING_PERIOD_SOFT_LOCKED");

    await transitionAccountingPeriod(context, open.id, { status: "CLOSED", reason: "Review completed" });
    await expect(db.$transaction((transaction) => assertAccountingDateOpen(transaction, context, new Date("2027-01-15T00:00:00.000Z")))).rejects.toThrow("ACCOUNTING_PERIOD_CLOSED");
  });

  it("enforces tenant scope, viewer read-only access, and entitlement state", async () => {
    const first = await setupBusiness("First Scope");
    const second = await setupBusiness("Second Scope");
    const firstPeriod = await createAccountingPeriod(first.context, period("January 2027", "2027-01-01", "2027-01-31"));

    await expect(getAccountingPeriod(second.context, firstPeriod.id)).rejects.toThrow("ACCOUNTING_PERIOD_NOT_FOUND");
    await expect(db.accountingPeriod.create({
      data: {
        tenantId: first.context.tenantId,
        businessId: second.context.businessId,
        name: "Cross tenant",
        startDate: new Date("2027-02-01T00:00:00.000Z"),
        endDate: new Date("2027-02-28T00:00:00.000Z"),
      },
    })).rejects.toThrow();

    const viewer = await createUser("Period Viewer");
    await db.tenantMembership.create({ data: { tenantId: first.onboarding.tenantId, userId: viewer.id, status: MembershipStatus.ACTIVE } });
    await db.businessMembership.create({
      data: { tenantId: first.onboarding.tenantId, businessId: first.onboarding.businessId, userId: viewer.id, roleKey: "business.viewer", status: MembershipStatus.ACTIVE },
    });
    const viewerContext = await requireBusinessAccessContext({ userId: viewer.id, businessId: first.onboarding.businessId });
    expect(await listAccountingPeriods(viewerContext)).toHaveLength(1);
    await expect(createAccountingPeriod(viewerContext, period("Denied", "2027-02-01", "2027-02-28"))).rejects.toThrow("BUSINESS_CAPABILITY_DENIED");

    const feature = await db.featureDefinition.findUniqueOrThrow({ where: { key: "accounting.core" } });
    await db.tenantEntitlementOverride.create({
      data: { tenantId: first.onboarding.tenantId, featureId: feature.id, enabled: false, unlimited: false, reason: "integration test" },
    });
    await expect(listAccountingPeriods(first.context)).rejects.toThrow("TENANT_FEATURE_DISABLED");
  });
});
