import { z } from "zod";
import { businessRoles } from "@/modules/access/roles";

const assignableRoleKeys = businessRoles
  .filter((role) => role.key !== "business.owner")
  .map((role) => role.key) as [string, ...string[]];

export const updateTenantMemberRequestSchema = z.object({
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  businessGrants: z.array(z.object({
    businessId: z.string().min(1),
    roleKey: z.enum(assignableRoleKeys),
    status: z.enum(["ACTIVE", "DISABLED"]).default("ACTIVE"),
  })).max(50).optional(),
}).refine((value) => value.status !== undefined || value.businessGrants !== undefined, {
  message: "At least one member access change is required.",
});
