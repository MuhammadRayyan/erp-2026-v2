INSERT INTO "FeatureDefinition" ("id", "key", "name", "description", "valueType", "createdAt", "updatedAt")
VALUES ('feature_catalog_core', 'catalog.core', 'Items and services', 'Business item, service, and unit master data.', 'BOOLEAN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "PlanEntitlement" ("id", "planId", "featureId", "enabled", "unlimited", "createdAt", "updatedAt")
SELECT CONCAT('plan_catalog_', p."id"), p."id", f."id", true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Plan" p
JOIN "FeatureDefinition" f ON f."key" = 'catalog.core'
WHERE p."active" = true
ON CONFLICT ("planId", "featureId") DO NOTHING;
