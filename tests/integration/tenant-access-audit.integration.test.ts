import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MembershipStatus } from "../../src/generated/prisma/client";
import { db } from "../../src/lib/db";
import { appendTenantAccessEvent, listTenantAccessEvents } from "../../src/modules/tenancy/server/access-audit";
import { acceptTenantInvitation, createTenantInvitation, listTenantAccessAdministration } from "../../src/modules/tenancy/server/invitations";
import { revokeTenantInvitation, updateTenantMemberAccess } from "../../src/modules/tenancy/server/member-access";
import { onboardOwner } from "../../src/modules/tenancy/server/onboarding";

async function ownerContext(label: string) {
  const user = await db.user.create({ data: { id: randomUUID(), name: `${label} Owner`, email: `${label}-${randomUUID()}@example.com`, emailVerified: true } });
  const operation = await onboardOwner({ idempotencyKey: `${label}-${randomUUID()}`, userId: user.id, tenantName: `${label} Tenant`, businessLegalName: `${label} Business LLC` });
  return { userId: user.id, tenantId: operation.tenantId, businessId: operation.businessId, email: user.email };
}

async function invitedUser(label: string) {
  return db.user.create({ data: { id: randomUUID(), name: `${label} Member`, email: `${label}-${randomUUID()}@example.com`, emailVerified: true } });
}

function serializedMetadata(events: Array<{ metadata: unknown }>) {
  return JSON.stringify(events.map((event) => event.metadata)).toLowerCase();
}

describe("tenant access audit", () => {
  it("records invitation creation, supersession, revocation, and exactly-once expiry without secrets", async () => {
    const owner = await ownerContext("tenant-audit-invitations");
    const email = `invite-${randomUUID()}@example.com`;
    const first = await createTenantInvitation({
      actorUserId: owner.userId,
      tenantId: owner.tenantId,
      email,
      expiresInDays: 7,
      businessGrants: [{ businessId: owner.businessId, roleKey: "business.viewer" }],
    });
    const second = await createTenantInvitation({
      actorUserId: owner.userId,
      tenantId: owner.tenantId,
      email,
      expiresInDays: 7,
      businessGrants: [{ businessId: owner.businessId, roleKey: "business.accountant" }],
    });
    await revokeTenantInvitation({ actorUserId: owner.userId, tenantId: owner.tenantId, invitationId: second.invitation.id });

    const expiring = await createTenantInvitation({
      actorUserId: owner.userId,
      tenantId: owner.tenantId,
      email: `expired-${randomUUID()}@example.com`,
      expiresInDays: 7,
      businessGrants: [{ businessId: owner.businessId, roleKey: "business.viewer" }],
    });
    await db.tenantInvitation.update({ where: { id: expiring.invitation.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await listTenantAccessAdministration({ actorUserId: owner.userId, tenantId: owner.tenantId });
    await listTenantAccessAdministration({ actorUserId: owner.userId, tenantId: owner.tenantId });

    const events = await db.tenantAccessEvent.findMany({ where: { tenantId: owner.tenantId }, orderBy: { occurredAt: "asc" } });
    expect(events.map((event) => event.eventType)).toEqual(expect.arrayContaining([
      "INVITATION_CREATED",
      "INVITATION_SUPERSEDED",
      "INVITATION_REVOKED",
      "INVITATION_EXPIRED",
    ]));
    expect(events.filter((event) => event.eventType === "INVITATION_EXPIRED" && event.invitationId === expiring.invitation.id)).toHaveLength(1);
    expect(await db.tenantInvitation.findUniqueOrThrow({ where: { id: first.invitation.id } })).toMatchObject({ status: "REVOKED" });
    const serialized = serializedMetadata(events);
    expect(serialized).not.toContain(first.token.toLowerCase());
    expect(serialized).not.toContain(second.token.toLowerCase());
    expect(serialized).not.toContain("http://");
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("tokendigest");
  });

  it("records acceptance, business access, role changes, disablement, session revocation, and no-op suppression", async () => {
    const owner = await ownerContext("tenant-audit-members");
    const member = await invitedUser("tenant-audit-members");
    const invitation = await createTenantInvitation({
      actorUserId: owner.userId,
      tenantId: owner.tenantId,
      email: member.email,
      expiresInDays: 7,
      businessGrants: [{ businessId: owner.businessId, roleKey: "business.viewer" }],
    });
    await acceptTenantInvitation({ userId: member.id, userEmail: member.email, token: invitation.token });

    const acceptedEvents = await db.tenantAccessEvent.findMany({ where: { tenantId: owner.tenantId, targetUserId: member.id } });
    expect(acceptedEvents.map((event) => event.eventType)).toEqual(expect.arrayContaining(["MEMBER_ACTIVATED", "BUSINESS_ACCESS_GRANTED", "INVITATION_ACCEPTED"]));

    await updateTenantMemberAccess({
      actorUserId: owner.userId,
      tenantId: owner.tenantId,
      targetUserId: member.id,
      businessGrants: [{ businessId: owner.businessId, roleKey: "business.accountant", status: "ACTIVE" }],
    });
    const afterRoleChange = await db.tenantAccessEvent.count({ where: { tenantId: owner.tenantId } });
    await updateTenantMemberAccess({
      actorUserId: owner.userId,
      tenantId: owner.tenantId,
      targetUserId: member.id,
      businessGrants: [{ businessId: owner.businessId, roleKey: "business.accountant", status: "ACTIVE" }],
    });
    expect(await db.tenantAccessEvent.count({ where: { tenantId: owner.tenantId } })).toBe(afterRoleChange);

    await db.session.create({ data: { id: randomUUID(), userId: member.id, token: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } });
    await updateTenantMemberAccess({ actorUserId: owner.userId, tenantId: owner.tenantId, targetUserId: member.id, status: "DISABLED" });
    expect(await db.session.count({ where: { userId: member.id } })).toBe(0);
    await updateTenantMemberAccess({ actorUserId: owner.userId, tenantId: owner.tenantId, targetUserId: member.id, status: "ACTIVE" });

    const events = await db.tenantAccessEvent.findMany({ where: { tenantId: owner.tenantId, targetUserId: member.id }, orderBy: { occurredAt: "asc" } });
    expect(events.map((event) => event.eventType)).toEqual(expect.arrayContaining([
      "BUSINESS_ACCESS_UPDATED",
      "MEMBER_DISABLED",
      "BUSINESS_ACCESS_DISABLED",
      "SESSIONS_REVOKED",
      "MEMBER_ACTIVATED",
    ]));
    const revoked = events.find((event) => event.eventType === "SESSIONS_REVOKED");
    expect(revoked?.metadata).toMatchObject({ count: 1, source: "MEMBER_DISABLED" });
    const roleChange = events.find((event) => event.eventType === "BUSINESS_ACCESS_UPDATED" && event.businessId === owner.businessId);
    expect(roleChange?.metadata).toMatchObject({ previousRoleKey: "business.viewer", roleKey: "business.accountant" });
    expect(serializedMetadata(events)).not.toMatch(/password|secret|token|https?:\/\//);

    await expect(updateTenantMemberAccess({
      actorUserId: owner.userId,
      tenantId: owner.tenantId,
      targetUserId: member.id,
      status: "DISABLED",
      businessGrants: [{ businessId: owner.businessId, roleKey: "business.viewer", status: "ACTIVE" }],
    })).rejects.toThrow("TENANT_MEMBER_GRANT_CONFLICT");
  });

  it("enforces owner-only listing, tenant scope, safe metadata, and database immutability", async () => {
    const first = await ownerContext("tenant-audit-first");
    const second = await ownerContext("tenant-audit-second");
    const member = await invitedUser("tenant-audit-first");
    await db.tenantMembership.create({ data: { tenantId: first.tenantId, userId: member.id, status: MembershipStatus.ACTIVE } });

    const invitation = await createTenantInvitation({
      actorUserId: first.userId,
      tenantId: first.tenantId,
      email: member.email,
      expiresInDays: 7,
      businessGrants: [{ businessId: first.businessId, roleKey: "business.viewer" }],
    });
    const event = await db.tenantAccessEvent.findFirstOrThrow({ where: { tenantId: first.tenantId, invitationId: invitation.invitation.id, eventType: "INVITATION_CREATED" } });

    const visible = await listTenantAccessEvents({ actorUserId: first.userId, tenantId: first.tenantId });
    expect(visible.some((row) => row.id === event.id)).toBe(true);
    await expect(listTenantAccessEvents({ actorUserId: member.id, tenantId: first.tenantId })).rejects.toThrow("TENANT_OWNER_REQUIRED");
    await expect(listTenantAccessEvents({ actorUserId: second.userId, tenantId: first.tenantId })).rejects.toThrow("TENANT_OWNER_REQUIRED");

    await expect(db.tenantAccessEvent.update({ where: { id: event.id }, data: { summary: "Rewritten" } })).rejects.toThrow("TENANT_ACCESS_EVENT_IMMUTABLE");
    await expect(db.tenantAccessEvent.delete({ where: { id: event.id } })).rejects.toThrow("TENANT_ACCESS_EVENT_IMMUTABLE");
    await expect(db.tenantAccessEvent.create({
      data: {
        tenantId: first.tenantId,
        eventType: "BUSINESS_ACCESS_GRANTED",
        targetEmail: member.email,
        businessId: second.businessId,
        summary: "Cross-tenant event",
        metadata: {},
      },
    })).rejects.toThrow();

    const beforeUnsafe = await db.tenantAccessEvent.count({ where: { tenantId: first.tenantId } });
    await expect(db.$transaction((transaction) => appendTenantAccessEvent(transaction, {
      tenantId: first.tenantId,
      eventType: "INVITATION_CREATED",
      actorUserId: first.userId,
      targetEmail: member.email,
      summary: "Unsafe event",
      metadata: { invitationUrl: "https://example.com/invitations/secret" },
    }))).rejects.toThrow("TENANT_ACCESS_AUDIT_UNSAFE");
    expect(await db.tenantAccessEvent.count({ where: { tenantId: first.tenantId } })).toBe(beforeUnsafe);
  });
});
