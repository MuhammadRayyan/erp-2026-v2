import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";
import { getParty, setPartyStatus, updateParty } from "@/modules/parties/server/parties";

async function accessContext(request: Request, businessId: string) {
  const session = await getRequestSession(request.headers);
  if (!session) throw new Error("AUTHENTICATION_REQUIRED");
  return requireBusinessAccessContext({ userId: session.user.id, businessId });
}

function responseStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "PARTY_UNAVAILABLE";
  if (message === "AUTHENTICATION_REQUIRED") return 401;
  if (message.includes("DENIED") || message.includes("DISABLED")) return 403;
  if (message.includes("NOT_FOUND")) return 404;
  return 409;
}

export async function GET(request: Request, context: { params: Promise<{ businessId: string; partyId: string }> }) {
  try {
    const { businessId, partyId } = await context.params;
    return NextResponse.json({ party: await getParty(await accessContext(request, businessId), partyId) });
  } catch (error) {
    return NextResponse.json({ message: "Party is unavailable." }, { status: responseStatus(error) });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ businessId: string; partyId: string }> }) {
  try {
    const { businessId, partyId } = await context.params;
    const access = await accessContext(request, businessId);
    const body = await request.json();
    const party = body.action === "status" ? await setPartyStatus(access, partyId, body) : await updateParty(access, partyId, body);
    return NextResponse.json({ party });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ message: "Check the party details.", issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: "The party could not be updated." }, { status: responseStatus(error) });
  }
}
