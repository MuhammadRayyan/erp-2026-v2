import { randomUUID } from "node:crypto";
import { EmailOutboxCategory } from "../../src/generated/prisma/client";
import { describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { createCatalogItem, createUnit, setCatalogItemStatus, setUnitStatus } from "../../src/modules/catalog/server/catalog";
import { commitCatalogImport, previewCatalogImport, resolveCatalogImportRow } from "../../src/modules/catalog/server/imports";
import { enqueueEmail, processEmailOutboxBatch } from "../../src/modules/communication/server/email-outbox";
import { createTenantInvitation, acceptTenantInvitation, listTenantAccessAdministration } from "../../src/modules/tenancy/server/invitations";
import { revokeTenantInvitation } from "../../src/modules/tenancy/server/member-access";
import { onboardOwner } from "../../src/modules/tenancy/server/onboarding";

async function createUser(label: string) {
  return db.user.create({
    data: { id: randomUUID(), name: `${label} User`, email: `${label}-${randomUUID()}@example.com`, emailVerified: true },
  });
}

async function ownerContext(label: string) {
  const user = await createUser(label);
  const operation = await onboardOwner({
    idempotencyKey: `${label}-${randomUUID()}`,
    userId: user.id,
    tenantName: `${label} Tenant`,
    businessLegalName: `${label} Business LLC`,
  });
  return {
    user,
    context: {
      userId: user.id,
      tenantId: operation.tenantId,
      businessId: operation.businessId,
      roleKey: "business.owner",
      tenantName: `${label} Tenant`,
      businessName: `${label} Business LLC`,
      planKey: "internal-unlimited",
      planName: "Internal Unlimited",
      enabledFeatures: ["catalog.core", "users.manage"],
    },
  };
}

function productInput(unitId: string) {
  return {
    type: "PRODUCT" as const,
    sku: `HARD-${randomUUID().slice(0, 8)}`,
    name: "Hardening product",
    description: "Regression fixture",
    unitId,
    salesEnabled: true,
    purchaseEnabled: true,
    defaultSalesPrice: "25.0000",
    defaultPurchasePrice: "10.0000",
    salesAccountClassKey: "SALES_REVENUE" as const,
    purchaseAccountClassKey: "INVENTORY_PURCHASES" as const,
    defaultSalesTaxCategory: "UNSPECIFIED" as const,
    defaultPurchaseTaxCategory: "UNSPECIFIED" as const,
  };
}

function csv(row: string) {
  return [
    "type,sku,name,description,unit_code,sales_enabled,purchase_enabled,sales_price,purchase_price,sales_account_class,purchase_account_class,sales_tax_category,purchase_tax_category",
    row,
  ].join("\n");
}

describe("Phase 3 hardening regressions", () => {
  it("rejects protected owner invitation grants", async () => {
    const { user, context } = await ownerContext("protected-invite-role");
    await expect(createTenantInvitation({
      actorUserId: user.id,
      tenantId: context.tenantId,
      email: `target-${randomUUID()}@example.com`,
      expiresInDays: 7,
      businessGrants: [{ businessId: context.businessId, roleKey: "business.owner" }],
    })).rejects.toThrow("INVALID_BUSINESS_ROLE");
  });

  it("persists invitation and outbox expiry before reporting the expired token", async () => {
    const { user, context } = await ownerContext("expired-invite");
    const target = await createUser("expired-target");
    const created = await createTenantInvitation({
      actorUserId: user.id,
      tenantId: context.tenantId,
      email: target.email,
      expiresInDays: 7,
      businessGrants: [{ businessId: context.businessId, roleKey: "business.viewer" }],
    });
    const past = new Date(Date.now() - 60_000);
    await db.tenantInvitation.update({ where: { id: created.invitation.id }, data: { expiresAt: past } });
    await db.emailOutbox.updateMany({ where: { correlationId: created.invitation.id }, data: { expiresAt: past } });

    await expect(acceptTenantInvitation({ userId: target.id, userEmail: target.email, token: created.token })).rejects.toThrow("INVITATION_EXPIRED");
    expect((await db.tenantInvitation.findUniqueOrThrow({ where: { id: created.invitation.id } })).status).toBe("EXPIRED");
    const delivery = await db.emailOutbox.findFirstOrThrow({ where: { correlationId: created.invitation.id } });
    expect(delivery.status).toBe("EXPIRED");
    expect(delivery.textBody).toBeNull();
    expect(delivery.htmlBody).toBeNull();
  });

  it("enforces users.manage in tenant administration services", async () => {
    const { user, context } = await ownerContext("users-entitlement");
    const created = await createTenantInvitation({
      actorUserId: user.id,
      tenantId: context.tenantId,
      email: `target-${randomUUID()}@example.com`,
      expiresInDays: 7,
      businessGrants: [{ businessId: context.businessId, roleKey: "business.viewer" }],
    });
    const feature = await db.featureDefinition.findUniqueOrThrow({ where: { key: "users.manage" } });
    await db.tenantEntitlementOverride.create({ data: { tenantId: context.tenantId, featureId: feature.id, enabled: false, reason: "Hardening regression" } });
    await expect(listTenantAccessAdministration({ actorUserId: user.id, tenantId: context.tenantId })).rejects.toThrow("TENANT_FEATURE_DISABLED");
    await expect(revokeTenantInvitation({ actorUserId: user.id, tenantId: context.tenantId, invitationId: created.invitation.id })).rejects.toThrow("TENANT_FEATURE_DISABLED");
  });

  it("rejects an invitation grant whose tenant differs from its invitation", async () => {
    const first = await ownerContext("grant-scope-first");
    const second = await ownerContext("grant-scope-second");
    const invitation = await createTenantInvitation({
      actorUserId: first.user.id,
      tenantId: first.context.tenantId,
      email: `target-${randomUUID()}@example.com`,
      expiresInDays: 7,
      businessGrants: [{ businessId: first.context.businessId, roleKey: "business.viewer" }],
    });
    await expect(db.businessInvitationGrant.create({
      data: {
        invitationId: invitation.invitation.id,
        tenantId: second.context.tenantId,
        businessId: second.context.businessId,
        roleKey: "business.viewer",
      },
    })).rejects.toThrow();
  });

  it("does not send a claimed invitation after its correlation becomes invalid", async () => {
    const { user, context } = await ownerContext("stale-delivery");
    const created = await createTenantInvitation({
      actorUserId: user.id,
      tenantId: context.tenantId,
      email: `target-${randomUUID()}@example.com`,
      expiresInDays: 7,
      businessGrants: [{ businessId: context.businessId, roleKey: "business.viewer" }],
    });
    await db.tenantInvitation.update({ where: { id: created.invitation.id }, data: { status: "REVOKED" } });
    let deliveries = 0;
    const result = await processEmailOutboxBatch({
      tenantId: context.tenantId,
      workerId: `hardening-${randomUUID()}`,
      send: async () => {
        deliveries += 1;
        return { messageId: "should-not-send" };
      },
    });
    expect(result).toMatchObject({ sent: 0, cancelled: 1 });
    expect(deliveries).toBe(0);
    expect((await db.emailOutbox.findFirstOrThrow({ where: { correlationId: created.invitation.id } })).status).toBe("CANCELLED");
  });

  it("rejects a changed payload that reuses an email idempotency key", async () => {
    const idempotencyKey = `hardening-email-${randomUUID()}`;
    await enqueueEmail(db, {
      category: EmailOutboxCategory.SYSTEM,
      recipient: "same@example.com",
      subject: "Original",
      textBody: "Original body",
      idempotencyKey,
    });
    await expect(enqueueEmail(db, {
      category: EmailOutboxCategory.SYSTEM,
      recipient: "same@example.com",
      subject: "Changed",
      textBody: "Changed body",
      idempotencyKey,
    })).rejects.toThrow("EMAIL_IDEMPOTENCY_CONFLICT");
  });

  it("prevents reactivating an item whose unit is inactive", async () => {
    const { context } = await ownerContext("catalog-reactivation");
    const unit = await createUnit(context, { code: "CASE", name: "Case", symbol: "case", dimension: "COUNT", decimalPlaces: 0 });
    const item = await createCatalogItem(context, productInput(unit.id));
    await setCatalogItemStatus(context, item.id, { status: "INACTIVE" });
    await setUnitStatus(context, unit.id, { active: false });
    await expect(setCatalogItemStatus(context, item.id, { status: "ACTIVE" })).rejects.toThrow("CATALOG_UNIT_NOT_FOUND");
    expect((await db.catalogItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("INACTIVE");
  });

  it("rejects an import update when its target changed after preview", async () => {
    const { context } = await ownerContext("import-stale-target");
    const unit = await db.unitOfMeasure.findFirstOrThrow({ where: { tenantId: context.tenantId, businessId: context.businessId, code: "EA" } });
    const existing = await createCatalogItem(context, { ...productInput(unit.id), sku: "HARD-IMPORT", name: "Preview name" });
    const batch = await previewCatalogImport(context, {
      sourceName: "stale.csv",
      csv: csv("PRODUCT,HARD-IMPORT,Imported replacement,,EA,true,true,30,12,SALES_REVENUE,INVENTORY_PURCHASES,UNSPECIFIED,UNSPECIFIED"),
    });
    await resolveCatalogImportRow(context, batch.id, batch.rows[0].id, "UPDATE");
    await db.catalogItem.update({ where: { id: existing.id }, data: { name: "Changed after preview", updatedAt: new Date(Date.now() + 1_000) } });
    await expect(commitCatalogImport(context, batch.id)).rejects.toThrow("CATALOG_IMPORT_TARGET_CHANGED");
    expect((await db.catalogImportBatch.findUniqueOrThrow({ where: { id: batch.id } })).status).toBe("PREVIEW");
  });
});
