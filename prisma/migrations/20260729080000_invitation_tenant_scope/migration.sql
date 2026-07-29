CREATE UNIQUE INDEX "TenantInvitation_tenantId_id_key"
ON "TenantInvitation"("tenantId", "id");

ALTER TABLE "BusinessInvitationGrant"
DROP CONSTRAINT "BusinessInvitationGrant_invitationId_fkey";

ALTER TABLE "BusinessInvitationGrant"
ADD CONSTRAINT "BusinessInvitationGrant_invitation_scope_fkey"
FOREIGN KEY ("tenantId", "invitationId")
REFERENCES "TenantInvitation"("tenantId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;
