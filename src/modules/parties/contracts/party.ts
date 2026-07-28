import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || null);

export const createPartySchema = z.object({
  type: z.enum(["ORGANIZATION", "INDIVIDUAL"]),
  roles: z.array(z.enum(["CUSTOMER", "SUPPLIER"])).min(1).max(2),
  legalName: optionalText(160),
  firstName: optionalText(80),
  lastName: optionalText(80),
  email: z.string().trim().email().optional().or(z.literal("")).transform((value) => value || null),
  phone: optionalText(40),
  taxRegistrationNumber: z.string().trim().regex(/^\d{15}$/).optional().or(z.literal("")).transform((value) => value || null),
  notes: optionalText(1000),
  contact: z.object({
    name: z.string().trim().min(2).max(120),
    jobTitle: optionalText(120),
    email: z.string().trim().email().optional().or(z.literal("")).transform((value) => value || null),
    phone: optionalText(40),
  }).optional(),
  address: z.object({
    type: z.enum(["BILLING", "DELIVERY", "SITE", "OTHER"]),
    line1: z.string().trim().min(2).max(180),
    line2: optionalText(180),
    city: optionalText(100),
    emirate: optionalText(100),
    postalCode: optionalText(30),
    countryCode: z.string().trim().length(2).default("AE"),
  }).optional(),
}).superRefine((value, context) => {
  if (value.type === "ORGANIZATION" && !value.legalName) {
    context.addIssue({ code: "custom", path: ["legalName"], message: "Organization name is required." });
  }
  if (value.type === "INDIVIDUAL" && !value.firstName) {
    context.addIssue({ code: "custom", path: ["firstName"], message: "First name is required." });
  }
});

export type CreatePartyInput = z.input<typeof createPartySchema>;
