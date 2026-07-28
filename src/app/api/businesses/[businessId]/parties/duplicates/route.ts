import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";
import { listPartyDuplicateReviews, reviewPartyDuplicate, scanPartyDuplicates } from "@/modules/parties/server/duplicates";

const reviewSchema = z.object({
  reviewId: z.string().min(1),
  status: z.enum(["CONFIRMED", "DISMISSED"]),
});

async function requestContext(request: Request, businessId: string) {
  const session = await getRequestSession(request.headers);
  if (!session) throw new Error("AUTHENTICATION_REQUIRED");
  return requireBusinessAccessContext({ userId: session.user.id, businessId });
}

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "PARTY_DUPLICATES_UNAVAILABLE";
  if (message === "AUTHENTICATION_REQUIRED") return 401;
  if (message.includes("DENIED") || message.includes("DISABLED")) return 403;
  if (message.includes("NOT_FOUND")) return 404;
  return 409;
}

export async function GET(request: Request, context: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await context.params;
    return NextResponse.json({ reviews: await listPartyDuplicateReviews(await requestContext(request, businessId)) });
  } catch (error) {
    return NextResponse.json({ message: "Duplicate reviews are unavailable." }, { status: statusFor(error) });
  }
}

export async function POST(request: Request, context: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await context.params;
    return NextResponse.json(await scanPartyDuplicates(await requestContext(request, businessId)));
  } catch (error) {
    return NextResponse.json({ message: "Duplicate scanning failed." }, { status: statusFor(error) });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await context.params;
    const input = reviewSchema.parse(await request.json());
    return NextResponse.json({ review: await reviewPartyDuplicate(await requestContext(request, businessId), input.reviewId, input.status) });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ message: "Check the review action.", issues: error.issues }, { status: 400 });
    return NextResponse.json({ message: "The duplicate review could not be updated." }, { status: statusFor(error) });
  }
}
