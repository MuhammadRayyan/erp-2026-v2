import { createHash } from "node:crypto";
import { MembershipStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { INTERNAL_UNLIMITED_PLAN_KEY } from "@/modules/entitlements/catalog";
import { z } from "zod";

const onboardingSchema = z.object({
  idempotencyKey: z.string().min(16).max(200),
  userId: z.string().min(1),
  tenantName: z.string().trim().min(2).max(120),
  businessLegalName: z.string().trim().min(2).max(160),
  businessTradingName: z.string().trim().max(160).optional(),
  countryCode: z.string().length(2).default("AE"),
  baseCurrency: z.string().length(3).default("AED"),
  timezone: z.string().min(1).default("Asia/Dubai"),
});

type OnboardingInput = z.input<typeof onboardingSchema>;

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "business";
}

function stableSuffix(key: string) {
  return createHash("sha256").update(key).digest("hex").slice(0, 10);
}

function isSerializableConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; meta?: { driverAdapterError?: { cause?: { originalCode?: unknown } } } };
  return candidate.code === "P2034" || candidate.meta?.driverAdapterError?.cause?.originalCode === "40001";
}

async function sleep(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function onboardOwner(rawInput: OnboardingInput) {
  const input = onboardingSchema.parse(rawInput);
  const existing = await db.onboardingOperation.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.userId !== input.userId) throw new Error("IDEMPOTENCY_KEY_CONFLICT");
    return existing;
  }

  const suffix = stableSuffix(input.idempotencyKey);
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await db.$transaction(async (transaction) => {
        const plan = await transaction.plan.findUnique({ where: { key: INTERNAL_UNLIMITED_PLAN_KEY }, select: { id: true, active: true } });
        if (!plan?.active) throw new Error("DEFAULT_PLAN_UNAVAILABLE");

        const tenant = await transaction.tenant.create({ data: { name: input.tenantName, slug: `${slugify(input.tenantName)}-${suffix}` } });
        await transaction.tenantSubscription.create({ data: { tenantId: tenant.id, planId: plan.id } });
        await transaction.tenantMembership.create({ data: { tenantId: tenant.id, userId: input.userId, isOwner: true, status: MembershipStatus.ACTIVE } });
        const business = await transaction.business.create({
          data: {
            tenantId: tenant.id,
            slug: `${slugify(input.businessLegalName)}-${suffix}`,
            legalName: input.businessLegalName,
            tradingName: input.businessTradingName,
            countryCode: input.countryCode,
            baseCurrency: input.baseCurrency,
            timezone: input.timezone,
          },
        });
        await transaction.businessProfile.create({ data: { tenantId: tenant.id, businessId: business.id } });
        await transaction.unitOfMeasure.createMany({
          data: [
            { tenantId: tenant.id, businessId: business.id, code: "EA", name: "Each", symbol: "ea", dimension: "COUNT", decimalPlaces: 0 },
            { tenantId: tenant.id, businessId: business.id, code: "HOUR", name: "Hour", symbol: "hr", dimension: "TIME", decimalPlaces: 2 },
            { tenantId: tenant.id, businessId: business.id, code: "DAY", name: "Day", symbol: "day", dimension: "TIME", decimalPlaces: 2 },
          ],
        });
        await transaction.numberSequence.createMany({
          data: [
            { tenantId: tenant.id, businessId: business.id, key: "QUOTATION", label: "Quotation", prefixTemplate: "Q-{YYYY}-", padding: 5, resetPolicy: "YEARLY" },
            { tenantId: tenant.id, businessId: business.id, key: "SALES_ORDER", label: "Sales order", prefixTemplate: "SO-{YYYY}-", padding: 5, resetPolicy: "YEARLY" },
            { tenantId: tenant.id, businessId: business.id, key: "SALES_INVOICE", label: "Sales invoice", prefixTemplate: "INV-{YYYY}-", padding: 5, resetPolicy: "YEARLY" },
            { tenantId: tenant.id, businessId: business.id, key: "PURCHASE_ORDER", label: "Purchase order", prefixTemplate: "PO-{YYYY}-", padding: 5, resetPolicy: "YEARLY" },
            { tenantId: tenant.id, businessId: business.id, key: "SUPPLIER_INVOICE", label: "Supplier invoice", prefixTemplate: "BILL-{YYYY}-", padding: 5, resetPolicy: "YEARLY" },
            { tenantId: tenant.id, businessId: business.id, key: "RECEIPT", label: "Receipt", prefixTemplate: "RCPT-{YYYY}-", padding: 5, resetPolicy: "YEARLY" },
            { tenantId: tenant.id, businessId: business.id, key: "PAYMENT", label: "Payment", prefixTemplate: "PAY-{YYYY}-", padding: 5, resetPolicy: "YEARLY" },
          ],
        });
        await transaction.businessMembership.create({
          data: { tenantId: tenant.id, businessId: business.id, userId: input.userId, roleKey: "business.owner", status: MembershipStatus.ACTIVE },
        });
        return transaction.onboardingOperation.create({
          data: { idempotencyKey: input.idempotencyKey, userId: input.userId, tenantId: tenant.id, businessId: business.id },
        });
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      const completed = await db.onboardingOperation.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (completed) {
        if (completed.userId !== input.userId) throw new Error("IDEMPOTENCY_KEY_CONFLICT");
        return completed;
      }
      if (!isSerializableConflict(error) || attempt === maxAttempts) throw error;
      await sleep(20 * attempt + Math.floor(Math.random() * 30));
    }
  }

  throw new Error("ONBOARDING_RETRY_EXHAUSTED");
}
