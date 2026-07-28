INSERT INTO "FeatureDefinition" ("id", "key", "name", "description", "valueType", "createdAt", "updatedAt")
VALUES ('feature_files_core', 'files.core', 'Private files and audit history', 'Tenant-scoped private file metadata, attachments, downloads, and audit history.', 'BOOLEAN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "PlanEntitlement" ("id", "planId", "featureId", "enabled", "unlimited", "createdAt", "updatedAt")
SELECT CONCAT('plan_files_', p."id"), p."id", f."id", true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Plan" p
JOIN "FeatureDefinition" f ON f."key" = 'files.core'
WHERE p."active" = true
ON CONFLICT ("planId", "featureId") DO NOTHING;
