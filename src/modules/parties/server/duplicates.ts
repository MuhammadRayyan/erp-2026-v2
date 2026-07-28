import type { BusinessAccessContext } from "@/modules/tenancy/server/context";
import { db } from "@/lib/db";
import { requireBusinessCapability } from "@/modules/access/server/authorize";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";

export type DuplicateCandidateRow = {
  firstPartyId: string;
  secondPartyId: string;
  firstDisplayName: string;
  secondDisplayName: string;
  nameSimilarity: number;
  exactEmail: boolean;
  exactPhone: boolean;
  exactTrn: boolean;
};

async function requireDuplicateAccess(context: BusinessAccessContext, capability: "parties.view" | "parties.manage") {
  requireBusinessCapability(context, capability);
  await requireTenantFeature(context.tenantId, "parties.core");
}

export async function scanPartyDuplicates(context: BusinessAccessContext) {
  await requireDuplicateAccess(context, "parties.manage");
  const candidates = await db.$queryRaw<DuplicateCandidateRow[]>`
    SELECT
      first."id" AS "firstPartyId",
      second."id" AS "secondPartyId",
      first."displayName" AS "firstDisplayName",
      second."displayName" AS "secondDisplayName",
      similarity(lower(first."displayName"), lower(second."displayName"))::double precision AS "nameSimilarity",
      (first."email" IS NOT NULL AND second."email" IS NOT NULL AND lower(first."email") = lower(second."email")) AS "exactEmail",
      (first."phone" IS NOT NULL AND second."phone" IS NOT NULL AND regexp_replace(first."phone", '\\D', '', 'g') = regexp_replace(second."phone", '\\D', '', 'g')) AS "exactPhone",
      (first."taxRegistrationNumber" IS NOT NULL AND second."taxRegistrationNumber" IS NOT NULL AND first."taxRegistrationNumber" = second."taxRegistrationNumber") AS "exactTrn"
    FROM "Party" first
    JOIN "Party" second
      ON first."tenantId" = second."tenantId"
      AND first."businessId" = second."businessId"
      AND first."id" < second."id"
    WHERE first."tenantId" = ${context.tenantId}
      AND first."businessId" = ${context.businessId}
      AND (
        similarity(lower(first."displayName"), lower(second."displayName")) >= 0.72
        OR (first."email" IS NOT NULL AND second."email" IS NOT NULL AND lower(first."email") = lower(second."email"))
        OR (first."phone" IS NOT NULL AND second."phone" IS NOT NULL AND regexp_replace(first."phone", '\\D', '', 'g') = regexp_replace(second."phone", '\\D', '', 'g'))
        OR (first."taxRegistrationNumber" IS NOT NULL AND second."taxRegistrationNumber" IS NOT NULL AND first."taxRegistrationNumber" = second."taxRegistrationNumber")
      )
    ORDER BY "exactTrn" DESC, "exactEmail" DESC, "exactPhone" DESC, "nameSimilarity" DESC
    LIMIT 250
  `;

  for (const candidate of candidates) {
    const exactEvidence = [candidate.exactTrn, candidate.exactEmail, candidate.exactPhone].filter(Boolean).length;
    const score = Math.min(1, candidate.nameSimilarity * 0.55 + exactEvidence * 0.25);
    const evidence = {
      nameSimilarity: Number(candidate.nameSimilarity.toFixed(4)),
      exactEmail: candidate.exactEmail,
      exactPhone: candidate.exactPhone,
      exactTrn: candidate.exactTrn,
    };
    await db.partyDuplicateReview.upsert({
      where: {
        tenantId_businessId_firstPartyId_secondPartyId: {
          tenantId: context.tenantId,
          businessId: context.businessId,
          firstPartyId: candidate.firstPartyId,
          secondPartyId: candidate.secondPartyId,
        },
      },
      create: {
        tenantId: context.tenantId,
        businessId: context.businessId,
        firstPartyId: candidate.firstPartyId,
        secondPartyId: candidate.secondPartyId,
        score,
        evidence,
      },
      update: {
        score,
        evidence,
      },
    });
  }

  return { candidatesFound: candidates.length };
}

export async function listPartyDuplicateReviews(context: BusinessAccessContext) {
  await requireDuplicateAccess(context, "parties.view");
  return db.partyDuplicateReview.findMany({
    where: { tenantId: context.tenantId, businessId: context.businessId },
    include: {
      firstParty: { select: { id: true, displayName: true, email: true, phone: true, taxRegistrationNumber: true, status: true } },
      secondParty: { select: { id: true, displayName: true, email: true, phone: true, taxRegistrationNumber: true, status: true } },
    },
    orderBy: [{ status: "asc" }, { score: "desc" }, { createdAt: "desc" }],
    take: 250,
  });
}

export async function reviewPartyDuplicate(
  context: BusinessAccessContext,
  reviewId: string,
  status: "CONFIRMED" | "DISMISSED",
) {
  await requireDuplicateAccess(context, "parties.manage");
  const review = await db.partyDuplicateReview.findFirst({
    where: { id: reviewId, tenantId: context.tenantId, businessId: context.businessId },
  });
  if (!review) throw new Error("PARTY_DUPLICATE_REVIEW_NOT_FOUND");
  return db.partyDuplicateReview.update({
    where: { id: reviewId },
    data: { status, reviewedByUserId: context.userId, reviewedAt: new Date() },
  });
}
