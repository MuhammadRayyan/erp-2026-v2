import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";
import {
  getBusinessProfile,
  updateBusinessProfile,
} from "@/modules/business-settings/server/business-profile";

async function requestContext(request: Request, businessId: string) {
  const session = await getRequestSession(request.headers);
  if (!session) throw new Error("AUTHENTICATION_REQUIRED");
  return requireBusinessAccessContext({ userId: session.user.id, businessId });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await context.params;
    const access = await requestContext(request, businessId);
    return NextResponse.json(await getBusinessProfile(access));
  } catch (error) {
    const message = error instanceof Error ? error.message : "PROFILE_UNAVAILABLE";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message.includes("DENIED") || message.includes("DISABLED") ? 403 : 404;
    return NextResponse.json({ message: "Business profile is unavailable." }, { status });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await context.params;
    const access = await requestContext(request, businessId);
    const profile = await updateBusinessProfile(access, await request.json());
    return NextResponse.json(profile);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { message: "Check the business profile details.", issues: error.issues },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "PROFILE_UPDATE_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message.includes("DENIED") || message.includes("DISABLED") ? 403 : 409;
    return NextResponse.json({ message: "The business profile could not be updated." }, { status });
  }
}
