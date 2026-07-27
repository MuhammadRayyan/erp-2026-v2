import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getRequestSession } from "@/modules/identity/server/session";
import { updateTenantMemberRequestSchema } from "@/modules/tenancy/contracts/member-access-request";
import { updateTenantMemberAccess } from "@/modules/tenancy/server/member-access";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tenantId: string; userId: string }> },
) {
  const session = await getRequestSession(request.headers);
  if (!session) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  try {
    const { tenantId, userId } = await context.params;
    const body = updateTenantMemberRequestSchema.parse(await request.json());
    const membership = await updateTenantMemberAccess({
      actorUserId: session.user.id,
      tenantId,
      targetUserId: userId,
      status: body.status,
      businessGrants: body.businessGrants,
    });

    return NextResponse.json({ membership });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: "Check the member access changes.", issues: error.issues }, { status: 400 });
    }

    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = code === "TENANT_OWNER_REQUIRED" ? 403 : code === "TENANT_MEMBER_NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ message: "Member access could not be updated.", code }, { status });
  }
}
