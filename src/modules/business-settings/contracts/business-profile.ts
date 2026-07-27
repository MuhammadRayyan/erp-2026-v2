import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null).nullable();

export const industryProfileKeys = [
  "GENERAL_SERVICES",
  "TECHNICAL_SERVICES",
  "AUTOMOTIVE_WORKSHOP",
  "CIVIL_ARCHITECTURAL",
  "GENERAL_TRADING",
] as const;

export const vatRegistrationStatuses = [
  "NOT_REGISTERED",
  "REGISTERED",
  "DEREGISTERED",
] as const;

export const documentLanguages = ["ENGLISH", "ARABIC", "BILINGUAL"] as const;

export const businessProfileInputSchema = z.object({
  industryProfile: z.enum(industryProfileKeys).nullable(),
  legalForm: optionalText(100),
  tradeLicenseNumber: optionalText(100),
  tradeLicenseAuthority: optionalText(160),
  vatRegistrationStatus: z.enum(vatRegistrationStatuses),
  trn: optionalText(15),
  vatEffectiveFrom: z.string().date().nullable(),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
  documentLanguage: z.enum(documentLanguages),
}).superRefine((value, context) => {
  if (value.vatRegistrationStatus === "REGISTERED") {
    if (!value.trn || !/^\d{15}$/.test(value.trn)) {
      context.addIssue({
        code: "custom",
        path: ["trn"],
        message: "A registered UAE business requires a 15-digit TRN.",
      });
    }
    if (!value.vatEffectiveFrom) {
      context.addIssue({
        code: "custom",
        path: ["vatEffectiveFrom"],
        message: "A VAT effective date is required for a registered business.",
      });
    }
  }
});

export type BusinessProfileInput = z.input<typeof businessProfileInputSchema>;
