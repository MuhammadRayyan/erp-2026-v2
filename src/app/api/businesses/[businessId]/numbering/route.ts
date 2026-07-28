import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";
import { listNumberSequences, updateNumberSequence, voidNumberAllocation } from "@/modules/numbering/server/numbering";

async function accessFor(request: Request, businessId: string) {
  const session = await getRequestSession(request.headers);
  if (!session) throw new Error("AUTHENTICATION_REQUIRED");
  return requireBusinessAccessContext({ userId: session.user.id, businessId });
}

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "NUMBERING_FAILED";
  if (message === "AUTHENTICATION_REQUIRED") return 401;
  if (message.includes("DENIED") || message.includes("DISABLED")) return 403;
  if (message.includes("NOT_FOUND")) return 404;
  return 409;
}

export async function GET(request: Request, context: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await context.params;
    return NextResponse.json({ sequences: await listNumberSequences(await accessFor(request, businessId)) });
  } catch (error) {
    return NextResponse.json({ message: "Numbering settings are unavailable." }, { status: statusFor(error) });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await context.params;
    const access = await accessFor(request, businessId);
    const body = await request.json();
    if (body.action === "update-sequence") {
      return NextResponse.json({ sequence: await updateNumberSequence(access, String(body.sequenceId), body.data) });
    }
    if (body.action === "void-allocation") {
      return NextResponse.json({ allocation: await voidNumberAllocation(access, String(body.allocationId), body.data) });
    }
    return NextResponse.json({ message: "Unknown numbering action." }, { status: 400 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ message: "Check the numbering details.", issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: "The numbering change could not be saved." }, { status: statusFor(error) });
  }
}
