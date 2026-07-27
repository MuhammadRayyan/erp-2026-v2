import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MembershipStatus } from "../../src/generated/prisma/client";
import { db } from "../../src/lib/db";
import { resolveBusinessAccessContext } from "../../src/modules/tenancy/server/context";
import { onboardOwner } from "../../src/modules/tenancy/server/onboarding";

async function resetDatabase() {
  await db.$transaction([
    db.onboardingOperation.deleteMany(),
    db.businessMembership.deleteMany(),
    db.business.deleteMany(),
    db.tenantMembership.deleteMany(),
    db.tenant.deleteMany(),
    db.session.deleteMany(),
    db.account.deleteMany(),
    db.verification.deleteMany(),
    db.user.deleteMany(),
  ]);
}

async function createUser(email: string) {
  return db.user.create({
    data: {
      id: randomUUID(),
      name: "Test Owner",
      email,
      emailVerified: true,
    },
  });
}

describe("identity and business access foundation", () => {
  beforeEach(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  it("creates one owner tenant and business idempotently", async () => {
    const user = await createUser("owner@example.com");
    const input = {
      idempotencyKey: "onboarding-test-owner-0001",
      userId: user.id,
      tenantName: "Owner Account",
      businessLegalName: "Example Technical Services LLC",
    };

    const first = await onboardOwner(input);
    const second = await onboardOwner(input);

    expect(second.id).toBe(first.id);
    expect(await db.tenant.count()).toBe(1);
    expect(await db.business.count()).toBe(1);
    expect(await db.tenantMembership.count()).toBe(1);
    expect(await db.businessMembership.count()).toBe(1);
  });

  it("resolves access only through active tenant and business membership", async () => {
    const user = await createUser("member@example.com");
    const onboarding = await onboardOwner({
      idempotencyKey: "onboarding-test-member-0002",
      userId: user.id,
      tenantName: "Member Account",
      businessLegalName: "Member Business LLC",
    });

    expect(
      await resolveBusinessAccessContext({
        userId: user.id,
        businessId: onboarding.businessId,
      }),
    ).toMatchObject({
      userId: user.id,
      tenantId: onboarding.tenantId,
      businessId: onboarding.businessId,
      roleKey: "business.owner",
    });

    await db.businessMembership.update({
      where: {
        businessId_userId: {
          businessId: onboarding.businessId,
          userId: user.id,
        },
      },
      data: { status: MembershipStatus.DISABLED },
    });

    expect(
      await resolveBusinessAccessContext({
        userId: user.id,
        businessId: onboarding.businessId,
      }),
    ).toBeNull();
  });

  it("rejects a business membership that crosses tenant boundaries", async () => {
    const firstUser = await createUser("first@example.com");
    const secondUser = await createUser("second@example.com");
    const first = await onboardOwner({
      idempotencyKey: "onboarding-cross-tenant-0001",
      userId: firstUser.id,
      tenantName: "First Tenant",
      businessLegalName: "First Business LLC",
    });
    const second = await onboardOwner({
      idempotencyKey: "onboarding-cross-tenant-0002",
      userId: secondUser.id,
      tenantName: "Second Tenant",
      businessLegalName: "Second Business LLC",
    });

    await expect(
      db.businessMembership.create({
        data: {
          tenantId: first.tenantId,
          businessId: second.businessId,
          userId: firstUser.id,
          roleKey: "business.viewer",
        },
      }),
    ).rejects.toThrow();
  });
});
