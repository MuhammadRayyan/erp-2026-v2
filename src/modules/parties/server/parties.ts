import type { BusinessAccessContext } from "@/modules/tenancy/server/context";
import { db } from "@/lib/db";
import { requireBusinessCapability } from "@/modules/access/server/authorize";
import { requireTenantFeature } from "@/modules/entitlements/server/resolve";
import { createPartySchema, type CreatePartyInput } from "@/modules/parties/contracts/party";

function normalizeSearch(values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").trim().toLowerCase();
}

export async function listParties(
  context: BusinessAccessContext,
  options: { query?: string; role?: "CUSTOMER" | "SUPPLIER" } = {},
) {
  requireBusinessCapability(context, "parties.view");
  await requireTenantFeature(context.tenantId, "parties.core");
  const query = options.query?.trim().toLowerCase();

  return db.party.findMany({
    where: {
      tenantId: context.tenantId,
      businessId: context.businessId,
      ...(query ? { searchText: { contains: query } } : {}),
      ...(options.role ? { roles: { some: { role: options.role } } } : {}),
    },
    orderBy: [{ status: "asc" }, { displayName: "asc" }],
    include: {
      roles: { select: { role: true } },
      contacts: { where: { isPrimary: true }, take: 1 },
      addresses: { where: { isDefault: true }, take: 1 },
    },
    take: 100,
  });
}

export async function createParty(context: BusinessAccessContext, rawInput: CreatePartyInput) {
  requireBusinessCapability(context, "parties.manage");
  await requireTenantFeature(context.tenantId, "parties.core");
  const input = createPartySchema.parse(rawInput);
  const displayName = input.type === "ORGANIZATION"
    ? input.legalName!
    : [input.firstName, input.lastName].filter(Boolean).join(" ");

  return db.party.create({
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
      searchText: normalizeSearch([
        displayName,
        input.legalName,
        input.firstName,
        input.lastName,
        input.email,
        input.phone,
        input.taxRegistrationNumber,
      ]),
      roles: {
        create: Array.from(new Set(input.roles)).map((role) => ({
          tenantId: context.tenantId,
          businessId: context.businessId,
          role,
        })),
      },
      contacts: input.contact ? {
        create: {
          tenantId: context.tenantId,
          businessId: context.businessId,
          name: input.contact.name,
          jobTitle: input.contact.jobTitle,
          email: input.contact.email,
          phone: input.contact.phone,
          isPrimary: true,
        },
      } : undefined,
      addresses: input.address ? {
        create: {
          tenantId: context.tenantId,
          businessId: context.businessId,
          type: input.address.type,
          line1: input.address.line1,
          line2: input.address.line2,
          city: input.address.city,
          emirate: input.address.emirate,
          postalCode: input.address.postalCode,
          countryCode: input.address.countryCode,
          isDefault: true,
        },
      } : undefined,
    },
    include: { roles: true, contacts: true, addresses: true },
  });
}
