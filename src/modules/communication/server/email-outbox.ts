import { randomUUID } from "node:crypto";
import { Prisma, type EmailOutbox, EmailOutboxCategory, EmailOutboxStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { sendPlatformEmail } from "@/modules/communication/server/platform-email";

export type QueueEmailInput = {
  tenantId?: string | null;
  category: EmailOutboxCategory;
  recipient: string;
  subject: string;
  textBody?: string | null;
  htmlBody?: string | null;
  idempotencyKey: string;
  correlationType?: string | null;
  correlationId?: string | null;
  expiresAt?: Date | null;
  maxAttempts?: number;
};

type DbClient = Prisma.TransactionClient | typeof db;

export async function enqueueEmail(client: DbClient, input: QueueEmailInput) {
  return client.emailOutbox.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    update: {},
    create: {
      tenantId: input.tenantId ?? null,
      category: input.category,
      recipient: input.recipient.trim().toLowerCase(),
      subject: input.subject.trim(),
      textBody: input.textBody ?? null,
      htmlBody: input.htmlBody ?? null,
      idempotencyKey: input.idempotencyKey,
      correlationType: input.correlationType ?? null,
      correlationId: input.correlationId ?? null,
      expiresAt: input.expiresAt ?? null,
      maxAttempts: input.maxAttempts ?? 5,
    },
  });
}

export function retryDelayMilliseconds(attempt: number) {
  return Math.min(60 * 60 * 1000, 30_000 * 2 ** Math.max(0, attempt - 1));
}

function errorText(error: unknown) {
  const value = error instanceof Error ? error.message : "UNKNOWN_EMAIL_ERROR";
  return value.slice(0, 1000);
}

async function recoverStaleAndExpired(now: Date, staleBefore: Date) {
  await db.$transaction([
    db.emailOutbox.updateMany({
      where: { status: EmailOutboxStatus.PROCESSING, lockedAt: { lt: staleBefore } },
      data: { status: EmailOutboxStatus.RETRY, lockedAt: null, lockedBy: null, availableAt: now, lastError: "STALE_WORKER_LOCK_RECOVERED" },
    }),
    db.emailOutbox.updateMany({
      where: { status: { in: [EmailOutboxStatus.PENDING, EmailOutboxStatus.RETRY] }, expiresAt: { lte: now } },
      data: { status: EmailOutboxStatus.EXPIRED, textBody: null, htmlBody: null, lockedAt: null, lockedBy: null, lastError: "MESSAGE_EXPIRED" },
    }),
  ]);
}

async function claimBatch(workerId: string, batchSize: number, now: Date) {
  return db.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<Array<EmailOutbox>>`
      WITH candidates AS (
        SELECT "id"
        FROM "EmailOutbox"
        WHERE "status" IN ('PENDING', 'RETRY')
          AND "availableAt" <= ${now}
          AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${batchSize}
      )
      UPDATE "EmailOutbox" AS message
      SET "status" = 'PROCESSING',
          "attempts" = message."attempts" + 1,
          "lockedAt" = ${now},
          "lockedBy" = ${workerId},
          "lastAttemptAt" = ${now},
          "updatedAt" = ${now}
      FROM candidates
      WHERE message."id" = candidates."id"
      RETURNING message.*
    `;
    return rows;
  });
}

async function markSent(message: EmailOutbox, providerMessageId: string | undefined) {
  await db.emailOutbox.updateMany({
    where: { id: message.id, status: EmailOutboxStatus.PROCESSING, lockedBy: message.lockedBy },
    data: {
      status: EmailOutboxStatus.SENT,
      sentAt: new Date(),
      providerMessageId: providerMessageId ?? null,
      textBody: null,
      htmlBody: null,
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  });
}

async function markFailedAttempt(message: EmailOutbox, error: unknown) {
  const terminal = message.attempts >= message.maxAttempts;
  await db.emailOutbox.updateMany({
    where: { id: message.id, status: EmailOutboxStatus.PROCESSING, lockedBy: message.lockedBy },
    data: terminal
      ? {
          status: EmailOutboxStatus.FAILED,
          failedAt: new Date(),
          textBody: null,
          htmlBody: null,
          lockedAt: null,
          lockedBy: null,
          lastError: errorText(error),
        }
      : {
          status: EmailOutboxStatus.RETRY,
          availableAt: new Date(Date.now() + retryDelayMilliseconds(message.attempts)),
          lockedAt: null,
          lockedBy: null,
          lastError: errorText(error),
        },
  });
}

export async function processEmailOutboxBatch(options?: { workerId?: string; batchSize?: number; staleAfterMs?: number }) {
  const workerId = options?.workerId ?? `worker-${randomUUID()}`;
  const batchSize = Math.min(Math.max(options?.batchSize ?? 10, 1), 50);
  const now = new Date();
  await recoverStaleAndExpired(now, new Date(now.getTime() - (options?.staleAfterMs ?? 10 * 60 * 1000)));
  const messages = await claimBatch(workerId, batchSize, now);
  let sent = 0;
  let retried = 0;
  let failed = 0;

  for (const message of messages) {
    try {
      if (!message.textBody && !message.htmlBody) throw new Error("EMAIL_PAYLOAD_MISSING");
      const result = await sendPlatformEmail({
        to: message.recipient,
        subject: message.subject,
        text: message.textBody ?? "",
        html: message.htmlBody ?? undefined,
      });
      await markSent(message, result.messageId);
      sent += 1;
    } catch (error) {
      await markFailedAttempt(message, error);
      if (message.attempts >= message.maxAttempts) failed += 1;
      else retried += 1;
    }
  }

  return { claimed: messages.length, sent, retried, failed };
}

export async function cancelQueuedEmail(correlationType: string, correlationId: string) {
  return db.emailOutbox.updateMany({
    where: {
      correlationType,
      correlationId,
      status: { in: [EmailOutboxStatus.PENDING, EmailOutboxStatus.RETRY] },
    },
    data: { status: EmailOutboxStatus.CANCELLED, textBody: null, htmlBody: null, lastError: "CORRELATION_CANCELLED" },
  });
}
