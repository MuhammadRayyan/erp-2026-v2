import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { serverEnv } from "@/lib/server-env";
import { sendPlatformEmail } from "@/modules/communication/server/platform-email";
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

    const invitationUrl = `${serverEnv.APP_URL}/invitations/${result.token}`;
    const grants = result.invitation.businessGrants
      .map((grant) => `${grant.business.legalName}: ${grant.roleKey.replace("business.", "")}`)
      .join("\n");

    try {
      const delivery = await sendPlatformEmail({
        to: result.invitation.email,
        subject: `Invitation to ${result.invitation.tenant.name}`,
        text: `${result.invitation.invitedBy.name} invited you to ${result.invitation.tenant.name}.\n\nBusiness access:\n${grants}\n\nAccept within ${body.expiresInDays} days: ${invitationUrl}`,
        html: `<p><strong>${result.invitation.invitedBy.name}</strong> invited you to <strong>${result.invitation.tenant.name}</strong>.</p><p>Accept this invitation within ${body.expiresInDays} days:</p><p><a href="${invitationUrl}">Accept invitation</a></p>`,
      });

      return NextResponse.json(
        {
          invitationId: result.invitation.id,
          expiresAt: result.invitation.expiresAt,
          deliveryStatus: "sent",
          messageId: delivery.messageId,
        },
        { status: 201 },
      );
    } catch (deliveryError) {
      console.error("Invitation email delivery failed", {
        invitationId: result.invitation.id,
        tenantId,
        error: deliveryError instanceof Error ? deliveryError.message : "Unknown email error",
      });

      return NextResponse.json(
        {
          invitationId: result.invitation.id,
          expiresAt: result.invitation.expiresAt,
          deliveryStatus: "failed",
          message: "The invitation was created, but the email could not be sent. Check SMTP settings and retry.",
        },
        { status: 502 },
      );
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: "Check the invitation details.", issues: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Unknown invitation error";
    const status = message === "TENANT_OWNER_REQUIRED" ? 403 : 409;
    return NextResponse.json({ message: "The invitation could not be created." }, { status });
  }
}
