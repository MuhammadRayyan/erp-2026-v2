CREATE TYPE "TenantAccessEventType" AS ENUM (
  'INVITATION_CREATED',
  'INVITATION_SUPERSEDED',
  'INVITATION_REVOKED',
  'INVITATION_EXPIRED',
  'INVITATION_ACCEPTED',
  'MEMBER_ACTIVATED',
  'MEMBER_DISABLED',
  'BUSINESS_ACCESS_GRANTED',
  'BUSINESS_ACCESS_UPDATED',
  'BUSINESS_ACCESS_DISABLED',
  'SESSIONS_REVOKED'
);

CREATE TABLE "TenantAccessEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventType" "TenantAccessEventType" NOT NULL,
  "actorUserId" TEXT,
  "targetUserId" TEXT,
  "targetEmail" TEXT,
  "businessId" TEXT,
  "invitationId" TEXT,
  "summary" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantAccessEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantAccessEvent_summary_check" CHECK (char_length(btrim("summary")) BETWEEN 1 AND 300),
  CONSTRAINT "TenantAccessEvent_target_check" CHECK ("targetUserId" IS NOT NULL OR "targetEmail" IS NOT NULL),
  CONSTRAINT "TenantAccessEvent_email_check" CHECK (
    "targetEmail" IS NULL OR (
      "targetEmail" = lower(btrim("targetEmail"))
      AND char_length("targetEmail") BETWEEN 3 AND 320
    )
  ),
  CONSTRAINT "TenantAccessEvent_metadata_check" CHECK (jsonb_typeof("metadata") = 'object')
);

CREATE UNIQUE INDEX "TenantAccessEvent_scope_id_key"
ON "TenantAccessEvent"("tenantId", "id");

CREATE INDEX "TenantAccessEvent_scope_time_idx"
ON "TenantAccessEvent"("tenantId", "occurredAt");

CREATE INDEX "TenantAccessEvent_type_time_idx"
ON "TenantAccessEvent"("tenantId", "eventType", "occurredAt");

CREATE INDEX "TenantAccessEvent_target_time_idx"
ON "TenantAccessEvent"("tenantId", "targetUserId", "occurredAt");

CREATE INDEX "TenantAccessEvent_invitation_time_idx"
ON "TenantAccessEvent"("tenantId", "invitationId", "occurredAt");

ALTER TABLE "TenantAccessEvent"
ADD CONSTRAINT "TenantAccessEvent_tenant_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TenantAccessEvent"
ADD CONSTRAINT "TenantAccessEvent_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TenantAccessEvent"
ADD CONSTRAINT "TenantAccessEvent_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TenantAccessEvent"
ADD CONSTRAINT "TenantAccessEvent_business_scope_fkey"
FOREIGN KEY ("tenantId", "businessId") REFERENCES "Business"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_tenant_access_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'TENANT_ACCESS_EVENT_IMMUTABLE';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TenantAccessEvent_immutable"
BEFORE UPDATE OR DELETE ON "TenantAccessEvent"
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_access_event_mutation();
