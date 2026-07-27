import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getRequestSession } from "@/modules/identity/server/session";
import { createInvitationRequestSchema } from "@/modules/tenancy/contracts/invitation-request";
import {
  createTenantInvitation,
  listTenantAccessAdministration,
} from "@/modules/tenancy/server/invitations";

export async function GET(
  request: Request,
  context: { params: Promise<{ tenantId: string }> },
) {
  const session = await getRequestSession(request.headers);
  if (!session) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  try {
    const { tenantId } = await context.params;
    const administration = await listTenantAccessAdministration({
      actorUserId: session.user.id,
      tenantId,
    });
    return NextResponse.json(administration);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown access error";
    const status = message === "TENANT_OWNER_REQUIRED" ? 403 : 404;
    return NextResponse.json({ message: "Tenant access administration is unavailable." }, { status });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ tenantId: string }> },
) {
  const session = await getRequestSession(request.headers);
  if (!session) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  try {
    const { tenantId } = await context.params;
    const body = createInvitationRequestSchema.parse(await request.json());
    const result = await createTenantInvitation({
      actorUserId: session.user.id,
      tenantId,
      email: body.email,
      expiresInDays: body.expiresInDays,
      businessGrants: body.businessGrants,
    });

    return NextResponse.json(
      {
        invitationId: result.invitation.id,
        invitationToken: result.token,
        expiresAt: result.invitation.expiresAt,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: "Check the invitation details.", issues: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Unknown invitation error";
    const status = message === "TENANT_OWNER_REQUIRED" ? 403 : 409;
    return NextResponse.json({ message: "The invitation could not be created." }, { status });
  }
}
