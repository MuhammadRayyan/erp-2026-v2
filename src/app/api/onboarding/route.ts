import { NextResponse } from "next/server";
import { getRequestSession } from "@/modules/identity/server/session";
import { onboardOwner } from "@/modules/tenancy/server/onboarding";

export async function POST(request: Request) {
  const session = await getRequestSession(request.headers);

  if (!session) {
    return NextResponse.json({ message: "Sign in before creating a business." }, { status: 401 });
  }

  const idempotencyKey = request.headers.get("Idempotency-Key");

  if (!idempotencyKey) {
    return NextResponse.json({ message: "An idempotency key is required." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const operation = await onboardOwner({
      idempotencyKey,
      userId: session.user.id,
      tenantName: body.tenantName,
      businessLegalName: body.businessLegalName,
      businessTradingName: body.businessTradingName,
      baseCurrency: body.baseCurrency,
      timezone: body.timezone,
      countryCode: "AE",
    });

    return NextResponse.json({
      tenantId: operation.tenantId,
      businessId: operation.businessId,
    });
  } catch (error) {
    console.error("Onboarding failed", error);
    return NextResponse.json(
      { message: "Check the business details and try again." },
      { status: 400 },
    );
  }
}
