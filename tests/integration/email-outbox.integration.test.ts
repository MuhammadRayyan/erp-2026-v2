import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { EmailOutboxCategory, EmailOutboxStatus } from "../../src/generated/prisma/client";
import { db } from "../../src/lib/db";
import { enqueueEmail, processEmailOutboxBatch } from "../../src/modules/communication/server/email-outbox";
import { createTenantInvitation, listTenantAccessAdministration } from "../../src/modules/tenancy/server/invitations";
import { onboardOwner } from "../../src/modules/tenancy/server/onboarding";

async function ownerContext(label: string) {
  const user = await db.user.create({ data: { id: randomUUID(), name: "Outbox Owner", email: `${label}-${randomUUID()}@example.com`, emailVerified: true } });
  const operation = await onboardOwner({ idempotencyKey: `${label}-${randomUUID()}`, userId: user.id, tenantName: `${label} Tenant`, businessLegalName: `${label} Business LLC` });
  return { userId: user.id, tenantId: operation.tenantId, businessId: operation.businessId };
}

describe("durable email outbox", () => {
  it("creates an invitation and its queued email atomically with visible delivery state", async () => {
    const context = await ownerContext("outbox-invitation");
    const result = await createTenantInvitation({ actorUserId: context.userId, tenantId: context.tenantId, email: `invite-${randomUUID()}@example.com`, expiresInDays: 7, businessGrants: [{ businessId: context.businessId, roleKey: "business.viewer" }] });
    const queued = await db.emailOutbox.findUniqueOrThrow({ where: { idempotencyKey: `tenant-invitation:${result.invitation.id}` } });
    expect(queued).toMatchObject({ tenantId: context.tenantId, status: EmailOutboxStatus.PENDING, category: EmailOutboxCategory.TENANT_INVITATION, correlationId: result.invitation.id });
    const administration = await listTenantAccessAdministration({ actorUserId: context.userId, tenantId: context.tenantId });
    expect(administration.invitations[0]?.delivery?.status).toBe(EmailOutboxStatus.PENDING);
  });

  it("allows concurrent workers to deliver each queued message once", async () => {
    const context = await ownerContext("outbox-concurrency");
    await enqueueEmail(db, { tenantId: context.tenantId, category: EmailOutboxCategory.SYSTEM, recipient: `once-${randomUUID()}@example.com`, subject: "Once", textBody: "Deliver once", idempotencyKey: `once-${randomUUID()}` });
    const send = vi.fn(async () => ({ messageId: randomUUID() }));
    await Promise.all([
      processEmailOutboxBatch({ workerId: "worker-a", tenantId: context.tenantId, batchSize: 10, send }),
      processEmailOutboxBatch({ workerId: "worker-b", tenantId: context.tenantId, batchSize: 10, send }),
    ]);
    expect(send).toHaveBeenCalledTimes(1);
    const row = await db.emailOutbox.findFirstOrThrow({ where: { tenantId: context.tenantId } });
    expect(row.status).toBe(EmailOutboxStatus.SENT);
    expect(row.textBody).toBeNull();
    expect(row.htmlBody).toBeNull();
  });

  it("retries failures, stops at the attempt budget, and scrubs terminal payloads", async () => {
    const context = await ownerContext("outbox-retry");
    const row = await enqueueEmail(db, { tenantId: context.tenantId, category: EmailOutboxCategory.SYSTEM, recipient: `retry-${randomUUID()}@example.com`, subject: "Retry", textBody: "Sensitive body", idempotencyKey: `retry-${randomUUID()}`, maxAttempts: 2 });
    const failing = vi.fn(async () => { throw new Error("SMTP_DOWN"); });
    const first = await processEmailOutboxBatch({ workerId: "retry-a", tenantId: context.tenantId, send: failing });
    expect(first.retried).toBe(1);
    await db.emailOutbox.update({ where: { id: row.id }, data: { availableAt: new Date(Date.now() - 1000) } });
    const second = await processEmailOutboxBatch({ workerId: "retry-b", tenantId: context.tenantId, send: failing });
    expect(second.failed).toBe(1);
    const failed = await db.emailOutbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(failed).toMatchObject({ status: EmailOutboxStatus.FAILED, attempts: 2, lastError: "SMTP_DOWN" });
    expect(failed.textBody).toBeNull();
    expect(failed.htmlBody).toBeNull();
  });

  it("expires undelivered messages and preserves idempotent enqueueing", async () => {
    const context = await ownerContext("outbox-expiry");
    const key = `expired-${randomUUID()}`;
    const first = await enqueueEmail(db, { tenantId: context.tenantId, category: EmailOutboxCategory.SYSTEM, recipient: `expired-${randomUUID()}@example.com`, subject: "Expired", textBody: "Expired body", idempotencyKey: key, expiresAt: new Date(Date.now() - 1000) });
    const second = await enqueueEmail(db, { tenantId: context.tenantId, category: EmailOutboxCategory.SYSTEM, recipient: "ignored@example.com", subject: "Ignored", textBody: "Ignored", idempotencyKey: key });
    expect(second.id).toBe(first.id);
    const result = await processEmailOutboxBatch({ tenantId: context.tenantId, send: async () => ({ messageId: "unused" }) });
    expect(result.claimed).toBe(0);
    const expired = await db.emailOutbox.findUniqueOrThrow({ where: { id: first.id } });
    expect(expired.status).toBe(EmailOutboxStatus.EXPIRED);
    expect(expired.textBody).toBeNull();
  });
});
