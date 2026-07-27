import { z } from "zod";

export const onboardingRequestSchema = z.object({
  tenantName: z.string().trim().min(2).max(120),
  businessLegalName: z.string().trim().min(2).max(160),
  businessTradingName: z.string().trim().max(160).optional(),
  baseCurrency: z.enum(["AED", "USD", "EUR", "SAR"]).default("AED"),
  timezone: z.string().trim().min(1).max(80).default("Asia/Dubai"),
});

export type OnboardingRequest = z.infer<typeof onboardingRequestSchema>;
