INSERT INTO "FeatureDefinition" ("id", "key", "name", "description", "valueType", "createdAt", "updatedAt")
VALUES ('feature_parties_core', 'parties.core', 'Parties and contacts', 'Shared customer, supplier, contact, and address master data.', 'BOOLEAN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "PlanEntitlement" ("id", "planId", "featureId", "enabled", "unlimited", "createdAt", "updatedAt")
SELECT CONCAT('plan_party_', p."id"), p."id", f."id", true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Plan" p
JOIN "FeatureDefinition" f ON f."key" = 'parties.core'
WHERE p."active" = true
ON CONFLICT ("planId", "featureId") DO NOTHING;
