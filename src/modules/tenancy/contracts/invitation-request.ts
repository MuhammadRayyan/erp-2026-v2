import { z } from "zod";
import { businessRoles } from "@/modules/access/roles";

const roleKeys = businessRoles.map((role) => role.key) as [string, ...string[]];

export const createInvitationRequestSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  expiresInDays: z.number().int().min(1).max(30).default(7),
  businessGrants: z
    .array(
      z.object({
        businessId: z.string().min(1),
        roleKey: z.enum(roleKeys),
      }),
    )
    .min(1)
    .superRefine((grants, context) => {
      const seen = new Set<string>();
      for (const grant of grants) {
        if (seen.has(grant.businessId)) {
          context.addIssue({
            code: "custom",
            message: "Each business may appear only once.",
          });
          return;
        }
        seen.add(grant.businessId);
      }
    }),
});

export const acceptInvitationRequestSchema = z.object({
  token: z.string().min(20),
});

export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;
