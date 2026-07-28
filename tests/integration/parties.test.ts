import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import {
  addPartyAddress,
  addPartyContact,
  createParty,
  getParty,
  listParties,
  setDefaultAddress,
  setPartyStatus,
  setPrimaryContact,
  updateParty,
} from "../../src/modules/parties/server/parties";
import { onboardOwner } from "../../src/modules/tenancy/server/onboarding";

async function ownerContext(label: string) {
  const user = await db.user.create({ data: { id: randomUUID(), name: "Party Test Owner", email: `${label}-${randomUUID()}@example.com`, emailVerified: true } });
  const operation = await onboardOwner({ idempotencyKey: `${label}-${randomUUID()}`, userId: user.id, tenantName: `${label} Tenant`, businessLegalName: `${label} Business LLC` });
  return { userId: user.id, tenantId: operation.tenantId, businessId: operation.businessId, roleKey: "business.owner", tenantName: `${label} Tenant`, businessName: `${label} Business LLC`, planKey: "internal-unlimited", planName: "Internal Unlimited", enabledFeatures: ["parties.core"] };
}

async function sampleParty(label: string) {
  const context = await ownerContext(label);
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
  return { context, party };
}

describe("parties and contacts", () => {
  it("creates one dual-role party with primary contact and address", async () => {
    const { context, party } = await sampleParty("party-create");
    expect(party.roles.map((role) => role.role).sort()).toEqual(["CUSTOMER", "SUPPLIER"]);
    expect(party.contacts[0]).toMatchObject({ name: "Amina Khan", isPrimary: true });
    expect(party.addresses[0]).toMatchObject({ city: "Dubai", isDefault: true });
    const results = await listParties(context, { query: "atlas", role: "CUSTOMER" });
    expect(results).toHaveLength(1);
  });

  it("updates identity and roles and rebuilds search text", async () => {
    const { context, party } = await sampleParty("party-update");
    const updated = await updateParty(context, party.id, {
      type: "ORGANIZATION",
      roles: ["CUSTOMER"],
      legalName: "Atlas Mobility LLC",
      email: "finance@atlas.example",
      phone: "+971511111111",
      taxRegistrationNumber: "100000000000003",
      notes: "Preferred customer",
    });
    expect(updated.displayName).toBe("Atlas Mobility LLC");
    expect(updated.roles.map((role) => role.role)).toEqual(["CUSTOMER"]);
    expect(await listParties(context, { query: "mobility" })).toHaveLength(1);
  });

  it("manages lifecycle, multiple contacts, and per-type default addresses", async () => {
    const { context, party } = await sampleParty("party-related");
    const contact = await addPartyContact(context, party.id, { name: "Omar Ali", email: "omar@atlas.example", isPrimary: false });
    await setPrimaryContact(context, party.id, contact.id);
    const site = await addPartyAddress(context, party.id, { type: "SITE", label: "Workshop", line1: "Al Quoz", city: "Dubai", emirate: "Dubai", countryCode: "AE", isDefault: false });
    await setDefaultAddress(context, party.id, site.id);
    await setPartyStatus(context, party.id, { status: "INACTIVE" });
    const detail = await getParty(context, party.id);
    expect(detail.status).toBe("INACTIVE");
    expect(detail.contacts.find((item) => item.id === contact.id)?.isPrimary).toBe(true);
    expect(detail.addresses.find((item) => item.id === site.id)?.isDefault).toBe(true);
  });

  it("denies party management to a read-only role", async () => {
    const context = await ownerContext("party-viewer");
    await expect(createParty({ ...context, roleKey: "business.viewer" }, { type: "INDIVIDUAL", roles: ["CUSTOMER"], firstName: "Read Only" })).rejects.toThrow("BUSINESS_CAPABILITY_DENIED");
  });

  it("prevents cross-tenant detail access and related updates", async () => {
    const first = await sampleParty("party-first");
    const second = await ownerContext("party-second");
    await expect(getParty(second, first.party.id)).rejects.toThrow();
    await expect(addPartyContact(second, first.party.id, { name: "Invalid Contact", isPrimary: true })).rejects.toThrow("PARTY_NOT_FOUND");
  });

  it("enforces the business tenant boundary in PostgreSQL", async () => {
    const first = await ownerContext("party-boundary-first");
    const second = await ownerContext("party-boundary-second");
    await expect(db.party.create({ data: { tenantId: first.tenantId, businessId: second.businessId, type: "ORGANIZATION", displayName: "Invalid Cross Tenant Party", legalName: "Invalid Cross Tenant Party", searchText: "invalid cross tenant party" } })).rejects.toThrow();
  });
});
