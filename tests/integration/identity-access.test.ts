import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { MembershipStatus } from "../../src/generated/prisma/client";
import { db } from "../../src/lib/db";
import { resolveBusinessAccessContext } from "../../src/modules/tenancy/server/context";
import { onboardOwner } from "../../src/modules/tenancy/server/onboarding";

async function createUser(label: string) {
  const suffix = randomUUID();

  return db.user.create({
    data: {
      id: randomUUID(),
      name: "Test Owner",
      email: `${label}-${suffix}@example.com`,
      emailVerified: true,
    },
  });
}

function testKey(label: string) {
  return `${label}-${randomUUID()}`;
}

describe("identity and business access foundation", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("creates one owner tenant and business idempotently", async () => {
    const user = await createUser("owner");
    const input = {
      idempotencyKey: testKey("onboarding-owner"),
      userId: user.id,
      tenantName: "Owner Account",
      businessLegalName: "Example Technical Services LLC",
    };

    const first = await onboardOwner(input);
    const second = await onboardOwner(input);

    expect(second.id).toBe(first.id);
    expect(await db.onboardingOperation.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(1);
    expect(await db.tenantMembership.count({ where: { tenantId: first.tenantId, userId: user.id } })).toBe(1);
    expect(await db.businessMembership.count({ where: { businessId: first.businessId, userId: user.id } })).toBe(1);
  });

  it("resolves access only through active tenant and business membership", async () => {
    const user = await createUser("member");
    const onboarding = await onboardOwner({
      idempotencyKey: testKey("onboarding-member"),
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
    const firstUser = await createUser("first");
    const secondUser = await createUser("second");
    const first = await onboardOwner({
      idempotencyKey: testKey("onboarding-cross-first"),
      userId: firstUser.id,
      tenantName: "First Tenant",
      businessLegalName: "First Business LLC",
    });
    const second = await onboardOwner({
      idempotencyKey: testKey("onboarding-cross-second"),
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
