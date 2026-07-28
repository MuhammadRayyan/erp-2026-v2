CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE UNIQUE INDEX "PartyContact_one_primary_per_party"
ON "PartyContact" ("tenantId", "businessId", "partyId")
WHERE "isPrimary" = true;

CREATE UNIQUE INDEX "PartyAddress_one_default_per_type"
ON "PartyAddress" ("tenantId", "businessId", "partyId", "type")
WHERE "isDefault" = true;

CREATE INDEX "Party_display_name_trgm_idx"
ON "Party" USING gin (lower("displayName") gin_trgm_ops);

CREATE INDEX "Party_search_text_trgm_idx"
ON "Party" USING gin ("searchText" gin_trgm_ops);

CREATE TYPE "PartyDuplicateReviewStatus" AS ENUM ('OPEN', 'CONFIRMED', 'DISMISSED');

CREATE TABLE "PartyDuplicateReview" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "firstPartyId" TEXT NOT NULL,
  "secondPartyId" TEXT NOT NULL,
  "status" "PartyDuplicateReviewStatus" NOT NULL DEFAULT 'OPEN',
  "score" DOUBLE PRECISION NOT NULL,
  "evidence" JSONB NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartyDuplicateReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PartyDuplicateReview_distinct_parties" CHECK ("firstPartyId" < "secondPartyId"),
  CONSTRAINT "PartyDuplicateReview_firstParty_fkey" FOREIGN KEY ("tenantId", "businessId", "firstPartyId") REFERENCES "Party"("tenantId", "businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PartyDuplicateReview_secondParty_fkey" FOREIGN KEY ("tenantId", "businessId", "secondPartyId") REFERENCES "Party"("tenantId", "businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PartyDuplicateReview_pair_key"
ON "PartyDuplicateReview" ("tenantId", "businessId", "firstPartyId", "secondPartyId");

CREATE INDEX "PartyDuplicateReview_status_score_idx"
ON "PartyDuplicateReview" ("tenantId", "businessId", "status", "score");
