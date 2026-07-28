import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || null);
const optionalEmail = z.string().trim().email().optional().or(z.literal("")).transform((value) => value || null);
const optionalTrn = z.string().trim().regex(/^\d{15}$/).optional().or(z.literal("")).transform((value) => value || null);

const partyIdentitySchema = z.object({
  type: z.enum(["ORGANIZATION", "INDIVIDUAL"]),
  roles: z.array(z.enum(["CUSTOMER", "SUPPLIER"])).min(1).max(2),
  legalName: optionalText(160),
  firstName: optionalText(80),
  lastName: optionalText(80),
  email: optionalEmail,
  phone: optionalText(40),
  taxRegistrationNumber: optionalTrn,
  notes: optionalText(1000),
}).superRefine((value, context) => {
  if (value.type === "ORGANIZATION" && !value.legalName) {
    context.addIssue({ code: "custom", path: ["legalName"], message: "Organization name is required." });
  }
  if (value.type === "INDIVIDUAL" && !value.firstName) {
    context.addIssue({ code: "custom", path: ["firstName"], message: "First name is required." });
  }
});

export const createContactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  jobTitle: optionalText(120),
  email: optionalEmail,
  phone: optionalText(40),
  isPrimary: z.boolean().default(false),
});

export const createAddressSchema = z.object({
  type: z.enum(["BILLING", "DELIVERY", "SITE", "OTHER"]),
  label: optionalText(80),
  line1: z.string().trim().min(2).max(180),
  line2: optionalText(180),
  city: optionalText(100),
  emirate: optionalText(100),
  postalCode: optionalText(30),
  countryCode: z.string().trim().length(2).default("AE"),
  isDefault: z.boolean().default(false),
});

export const createPartySchema = partyIdentitySchema.extend({
  contact: createContactSchema.omit({ isPrimary: true }).optional(),
  address: createAddressSchema.omit({ isDefault: true, label: true }).optional(),
});

export const updatePartySchema = partyIdentitySchema;
export const partyStatusSchema = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) });

export type CreatePartyInput = z.input<typeof createPartySchema>;
export type UpdatePartyInput = z.input<typeof updatePartySchema>;
export type CreateContactInput = z.input<typeof createContactSchema>;
export type CreateAddressInput = z.input<typeof createAddressSchema>;
