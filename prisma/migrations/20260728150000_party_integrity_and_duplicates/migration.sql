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
