import type { BusinessAccessContext } from "@/modules/tenancy/server/context";
import { db } from "@/lib/db";
import { requireBusinessCapability } from "@/modules/access/server/authorize";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";
import {
  createAddressSchema,
  createContactSchema,
  createPartySchema,
  partyStatusSchema,
  updatePartySchema,
  type CreateAddressInput,
  type CreateContactInput,
  type CreatePartyInput,
  type UpdatePartyInput,
} from "@/modules/parties/contracts/party";

function normalizeSearch(values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").trim().toLowerCase();
}

function displayNameFor(input: { type: "ORGANIZATION" | "INDIVIDUAL"; legalName: string | null; firstName: string | null; lastName: string | null }) {
  return input.type === "ORGANIZATION" ? input.legalName! : [input.firstName, input.lastName].filter(Boolean).join(" ");
}

async function assertPartyScope(context: BusinessAccessContext, partyId: string) {
  const party = await db.party.findFirst({ where: { id: partyId, tenantId: context.tenantId, businessId: context.businessId } });
  if (!party) throw new Error("PARTY_NOT_FOUND");
  return party;
}

async function requirePartyFeature(context: BusinessAccessContext, capability: "parties.view" | "parties.manage") {
  requireBusinessCapability(context, capability);
  await requireTenantFeature(context.tenantId, "parties.core");
}

async function lockParty(transaction: Parameters<Parameters<typeof db.$transaction>[0]>[0], context: BusinessAccessContext, partyId: string) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Party"
    WHERE "id" = ${partyId} AND "tenantId" = ${context.tenantId} AND "businessId" = ${context.businessId}
    FOR UPDATE
  `;
  if (rows.length === 0) throw new Error("PARTY_NOT_FOUND");
}

export async function listParties(context: BusinessAccessContext, options: { query?: string; role?: "CUSTOMER" | "SUPPLIER" } = {}) {
  await requirePartyFeature(context, "parties.view");
  const query = options.query?.trim().toLowerCase();
  return db.party.findMany({
    where: {
      tenantId: context.tenantId,
      businessId: context.businessId,
      ...(query ? { searchText: { contains: query } } : {}),
      ...(options.role ? { roles: { some: { role: options.role } } } : {}),
    },
    orderBy: [{ status: "asc" }, { displayName: "asc" }],
    include: { roles: { select: { role: true } }, contacts: { where: { isPrimary: true }, take: 1 }, addresses: { where: { isDefault: true }, take: 1 } },
    take: 100,
  });
}

export async function getParty(context: BusinessAccessContext, partyId: string) {
  await requirePartyFeature(context, "parties.view");
  const party = await db.party.findFirst({
    where: { id: partyId, tenantId: context.tenantId, businessId: context.businessId },
    include: { roles: { orderBy: { role: "asc" } }, contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] }, addresses: { orderBy: [{ isDefault: "desc" }, { type: "asc" }, { line1: "asc" }] } },
  });
  if (!party) throw new Error("PARTY_NOT_FOUND");
  return party;
}

export async function createParty(context: BusinessAccessContext, rawInput: CreatePartyInput) {
  await requirePartyFeature(context, "parties.manage");
  const input = createPartySchema.parse(rawInput);
  const displayName = displayNameFor(input);
  return db.$transaction(async (transaction) => {
    const party = await transaction.party.create({
      data: {
        tenantId: context.tenantId,
        businessId: context.businessId,
        type: input.type,
        displayName,
        legalName: input.legalName,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        taxRegistrationNumber: input.taxRegistrationNumber,
        notes: input.notes,
        searchText: normalizeSearch([displayName, input.legalName, input.firstName, input.lastName, input.email, input.phone, input.taxRegistrationNumber]),
      },
    });
    await transaction.partyRole.createMany({ data: Array.from(new Set(input.roles)).map((role) => ({ tenantId: context.tenantId, businessId: context.businessId, partyId: party.id, role })) });
    if (input.contact) await transaction.partyContact.create({ data: { tenantId: context.tenantId, businessId: context.businessId, partyId: party.id, ...input.contact, isPrimary: true } });
    if (input.address) await transaction.partyAddress.create({ data: { tenantId: context.tenantId, businessId: context.businessId, partyId: party.id, ...input.address, isDefault: true } });
    return transaction.party.findUniqueOrThrow({ where: { id: party.id }, include: { roles: true, contacts: true, addresses: true } });
  });
}

export async function updateParty(context: BusinessAccessContext, partyId: string, rawInput: UpdatePartyInput) {
  await requirePartyFeature(context, "parties.manage");
  await assertPartyScope(context, partyId);
  const input = updatePartySchema.parse(rawInput);
  const displayName = displayNameFor(input);
  return db.$transaction(async (transaction) => {
    await lockParty(transaction, context, partyId);
    await transaction.party.update({
      where: { id: partyId },
      data: {
        type: input.type,
        displayName,
        legalName: input.legalName,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        taxRegistrationNumber: input.taxRegistrationNumber,
        notes: input.notes,
        searchText: normalizeSearch([displayName, input.legalName, input.firstName, input.lastName, input.email, input.phone, input.taxRegistrationNumber]),
      },
    });
    await transaction.partyRole.deleteMany({ where: { tenantId: context.tenantId, businessId: context.businessId, partyId } });
    await transaction.partyRole.createMany({ data: Array.from(new Set(input.roles)).map((role) => ({ tenantId: context.tenantId, businessId: context.businessId, partyId, role })) });
    return transaction.party.findUniqueOrThrow({ where: { id: partyId }, include: { roles: true, contacts: true, addresses: true } });
  });
}

export async function setPartyStatus(context: BusinessAccessContext, partyId: string, rawInput: unknown) {
  await requirePartyFeature(context, "parties.manage");
  await assertPartyScope(context, partyId);
  const { status } = partyStatusSchema.parse(rawInput);
  return db.party.update({ where: { id: partyId }, data: { status } });
}

export async function addPartyContact(context: BusinessAccessContext, partyId: string, rawInput: CreateContactInput) {
  await requirePartyFeature(context, "parties.manage");
  const input = createContactSchema.parse(rawInput);
  return db.$transaction(async (transaction) => {
    await lockParty(transaction, context, partyId);
    if (input.isPrimary) await transaction.partyContact.updateMany({ where: { tenantId: context.tenantId, businessId: context.businessId, partyId }, data: { isPrimary: false } });
    return transaction.partyContact.create({ data: { tenantId: context.tenantId, businessId: context.businessId, partyId, ...input } });
  });
}

export async function setPrimaryContact(context: BusinessAccessContext, partyId: string, contactId: string) {
  await requirePartyFeature(context, "parties.manage");
  return db.$transaction(async (transaction) => {
    await lockParty(transaction, context, partyId);
    const contact = await transaction.partyContact.findFirst({ where: { id: contactId, tenantId: context.tenantId, businessId: context.businessId, partyId } });
    if (!contact) throw new Error("PARTY_CONTACT_NOT_FOUND");
    await transaction.partyContact.updateMany({ where: { tenantId: context.tenantId, businessId: context.businessId, partyId }, data: { isPrimary: false } });
    return transaction.partyContact.update({ where: { id: contactId }, data: { isPrimary: true } });
  });
}

export async function addPartyAddress(context: BusinessAccessContext, partyId: string, rawInput: CreateAddressInput) {
  await requirePartyFeature(context, "parties.manage");
  const input = createAddressSchema.parse(rawInput);
  return db.$transaction(async (transaction) => {
    await lockParty(transaction, context, partyId);
    if (input.isDefault) await transaction.partyAddress.updateMany({ where: { tenantId: context.tenantId, businessId: context.businessId, partyId, type: input.type }, data: { isDefault: false } });
    return transaction.partyAddress.create({ data: { tenantId: context.tenantId, businessId: context.businessId, partyId, ...input } });
  });
}

export async function setDefaultAddress(context: BusinessAccessContext, partyId: string, addressId: string) {
  await requirePartyFeature(context, "parties.manage");
  return db.$transaction(async (transaction) => {
    await lockParty(transaction, context, partyId);
    const address = await transaction.partyAddress.findFirst({ where: { id: addressId, tenantId: context.tenantId, businessId: context.businessId, partyId } });
    if (!address) throw new Error("PARTY_ADDRESS_NOT_FOUND");
    await transaction.partyAddress.updateMany({ where: { tenantId: context.tenantId, businessId: context.businessId, partyId, type: address.type }, data: { isDefault: false } });
    return transaction.partyAddress.update({ where: { id: addressId }, data: { isDefault: true } });
  });
}
