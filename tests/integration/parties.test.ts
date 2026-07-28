import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { createParty, listParties } from "../../src/modules/parties/server/parties";
import { onboardOwner } from "../../src/modules/tenancy/server/onboarding";

async function ownerContext(label: string) {
  const user = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Party Test Owner",
      email: `${label}-${randomUUID()}@example.com`,
      emailVerified: true,
    },
  });
  const operation = await onboardOwner({
    idempotencyKey: `${label}-${randomUUID()}`,
    userId: user.id,
    tenantName: `${label} Tenant`,
    businessLegalName: `${label} Business LLC`,
  });
  return {
    userId: user.id,
    tenantId: operation.tenantId,
    businessId: operation.businessId,
    roleKey: "business.owner",
    tenantName: `${label} Tenant`,
    businessName: `${label} Business LLC`,
    planKey: "internal-unlimited",
    planName: "Internal Unlimited",
    enabledFeatures: new Set(["parties.core"]),
  };
}

describe("parties and contacts", () => {
  it("creates one dual-role party with primary contact and address", async () => {
    const context = await ownerContext("party-create");
    const party = await createParty(context, {
      type: "ORGANIZATION",
      roles: ["CUSTOMER", "SUPPLIER"],
      legalName: "Atlas Technical Services LLC",
      email: "accounts@atlas.example",
      phone: "+971500000000",
      taxRegistrationNumber: "100000000000003",
      contact: { name: "Amina Khan", jobTitle: "Finance Manager", email: "amina@atlas.example" },
      address: { type: "BILLING", line1: "Office 12", city: "Dubai", emirate: "Dubai", countryCode: "AE" },
    });

    expect(party.roles.map((role) => role.role).sort()).toEqual(["CUSTOMER", "SUPPLIER"]);
    expect(party.contacts[0]).toMatchObject({ name: "Amina Khan", isPrimary: true });
    expect(party.addresses[0]).toMatchObject({ city: "Dubai", isDefault: true });

    const results = await listParties(context, { query: "atlas", role: "CUSTOMER" });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(party.id);
  });

  it("denies party management to a read-only role", async () => {
    const context = await ownerContext("party-viewer");
    await expect(createParty({ ...context, roleKey: "business.viewer" }, {
      type: "INDIVIDUAL",
      roles: ["CUSTOMER"],
      firstName: "Read Only",
    })).rejects.toThrow("BUSINESS_CAPABILITY_DENIED");
  });

  it("enforces the business tenant boundary in PostgreSQL", async () => {
    const first = await ownerContext("party-first");
    const second = await ownerContext("party-second");
    await expect(db.party.create({
      data: {
        tenantId: first.tenantId,
        businessId: second.businessId,
        type: "ORGANIZATION",
        displayName: "Invalid Cross Tenant Party",
        legalName: "Invalid Cross Tenant Party",
        searchText: "invalid cross tenant party",
      },
    })).rejects.toThrow();
  });
});
