-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "TenantInvitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenDigest" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "acceptedByUserId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessInvitationGrant" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,

    CONSTRAINT "BusinessInvitationGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantInvitation_tokenDigest_key" ON "TenantInvitation"("tokenDigest");
CREATE INDEX "TenantInvitation_tenantId_status_expiresAt_idx" ON "TenantInvitation"("tenantId", "status", "expiresAt");
CREATE INDEX "TenantInvitation_email_status_idx" ON "TenantInvitation"("email", "status");
CREATE UNIQUE INDEX "BusinessInvitationGrant_invitationId_businessId_key" ON "BusinessInvitationGrant"("invitationId", "businessId");
CREATE INDEX "BusinessInvitationGrant_tenantId_businessId_idx" ON "BusinessInvitationGrant"("tenantId", "businessId");

-- AddForeignKey
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessInvitationGrant" ADD CONSTRAINT "BusinessInvitationGrant_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "TenantInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessInvitationGrant" ADD CONSTRAINT "BusinessInvitationGrant_tenantId_businessId_fkey" FOREIGN KEY ("tenantId", "businessId") REFERENCES "Business"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
