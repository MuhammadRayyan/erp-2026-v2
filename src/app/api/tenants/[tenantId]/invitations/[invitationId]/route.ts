import { NextResponse } from "next/server";
import { getRequestSession } from "@/modules/identity/server/session";
import { revokeTenantInvitation } from "@/modules/tenancy/server/member-access";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ tenantId: string; invitationId: string }> },
) {
  const session = await getRequestSession(request.headers);
  if (!session) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  try {
    const { tenantId, invitationId } = await context.params;
    await revokeTenantInvitation({
      actorUserId: session.user.id,
      tenantId,
      invitationId,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = code === "TENANT_OWNER_REQUIRED" ? 403 : 404;
    return NextResponse.json({ message: "Invitation could not be revoked.", code }, { status });
  }
}
