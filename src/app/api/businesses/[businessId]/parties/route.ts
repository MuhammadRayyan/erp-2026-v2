import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";
import { createParty, listParties } from "@/modules/parties/server/parties";

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
    const url = new URL(request.url);
    const role = url.searchParams.get("role");
    const parties = await listParties(access, {
      query: url.searchParams.get("q") ?? undefined,
      role: role === "CUSTOMER" || role === "SUPPLIER" ? role : undefined,
    });
    return NextResponse.json({ parties });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PARTIES_UNAVAILABLE";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message.includes("DENIED") || message.includes("DISABLED") ? 403 : 404;
    return NextResponse.json({ message: "Parties are unavailable." }, { status });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await context.params;
    const access = await requestContext(request, businessId);
    const party = await createParty(access, await request.json());
    return NextResponse.json({ party }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: "Check the party details.", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "PARTY_CREATE_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message.includes("DENIED") || message.includes("DISABLED") ? 403 : 409;
    return NextResponse.json({ message: "The party could not be created." }, { status });
  }
}
