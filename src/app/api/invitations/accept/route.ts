import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getRequestSession } from "@/modules/identity/server/session";
import { acceptInvitationRequestSchema } from "@/modules/tenancy/contracts/invitation-request";
import { acceptTenantInvitation } from "@/modules/tenancy/server/invitations";

export async function POST(request: Request) {
  const session = await getRequestSession(request.headers);
  if (!session) {
    return NextResponse.json({ message: "Sign in with the invited email address." }, { status: 401 });
  }

  try {
    const body = acceptInvitationRequestSchema.parse(await request.json());
    const invitation = await acceptTenantInvitation({
      userId: session.user.id,
      userEmail: session.user.email,
      token: body.token,
    });

    return NextResponse.json({
      tenantId: invitation.tenantId,
      businessIds: invitation.businessGrants.map((grant) => grant.businessId),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: "The invitation link is invalid." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Unknown invitation error";
    const status = message === "INVITATION_EMAIL_MISMATCH" ? 403 : 409;
    return NextResponse.json({ message: "The invitation could not be accepted." }, { status });
  }
}
