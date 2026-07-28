import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";
import { addPartyAddress, addPartyContact, setDefaultAddress, setPrimaryContact } from "@/modules/parties/server/parties";

export async function POST(request: Request, context: { params: Promise<{ businessId: string; partyId: string }> }) {
  try {
    const session = await getRequestSession(request.headers);
    if (!session) return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    const { businessId, partyId } = await context.params;
    const access = await requireBusinessAccessContext({ userId: session.user.id, businessId });
    const body = await request.json();
    if (body.action === "add-contact") await addPartyContact(access, partyId, body.data);
    else if (body.action === "primary-contact") await setPrimaryContact(access, partyId, body.contactId);
    else if (body.action === "add-address") await addPartyAddress(access, partyId, body.data);
    else if (body.action === "default-address") await setDefaultAddress(access, partyId, body.addressId);
    else return NextResponse.json({ message: "Unknown party action." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ message: "Check the submitted details.", issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : "PARTY_RELATED_UPDATE_FAILED";
    const status = message.includes("DENIED") || message.includes("DISABLED") ? 403 : message.includes("NOT_FOUND") ? 404 : 409;
    return NextResponse.json({ message: "The party details could not be updated." }, { status });
  }
}
