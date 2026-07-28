INSERT INTO "FeatureDefinition" ("id", "key", "name", "description", "valueType", "createdAt", "updatedAt")
VALUES ('feature_custom_fields_core', 'custom-fields.core', 'Custom fields', 'Business-scoped typed custom-field definitions and values.', 'BOOLEAN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "PlanEntitlement" ("id", "planId", "featureId", "enabled", "unlimited", "createdAt", "updatedAt")
SELECT CONCAT('plan_custom_fields_', p."id"), p."id", f."id", true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Plan" p
JOIN "FeatureDefinition" f ON f."key" = 'custom-fields.core'
WHERE p."active" = true
ON CONFLICT ("planId", "featureId") DO NOTHING;
