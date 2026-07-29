import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createAccountingPeriod, listAccountingPeriods } from "@/modules/accounting/server/periods";
import { getRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";

async function requestContext(request: Request, businessId: string) {
  const session = await getRequestSession(request.headers);
  if (!session) throw new Error("AUTHENTICATION_REQUIRED");
  return requireBusinessAccessContext({ userId: session.user.id, businessId });
}

function errorCode(error: unknown) {
  return error instanceof Error ? error.message : "ACCOUNTING_PERIOD_UNAVAILABLE";
}

function statusFor(error: unknown) {
  const message = errorCode(error);
  if (message === "AUTHENTICATION_REQUIRED") return 401;
  if (message.includes("DENIED") || message.includes("DISABLED")) return 403;
  if (message.includes("NOT_FOUND")) return 404;
  return 409;
}

function messageFor(error: unknown) {
  const message = errorCode(error);
  if (message.includes("ACCOUNTING_PERIOD_OVERLAP")) return "The period overlaps an existing accounting period.";
  if (message.includes("ACCOUNTING_PERIOD_FISCAL_YEAR_BOUNDARY")) return "The period must remain within one configured fiscal year.";
  if (message.includes("ACCOUNTING_PERIOD_PROFILE_REQUIRED")) return "Complete the business fiscal settings before creating periods.";
  return "The accounting period could not be created.";
}

export async function GET(request: Request, context: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await context.params;
    const access = await requestContext(request, businessId);
    return NextResponse.json({ periods: await listAccountingPeriods(access) });
  } catch (error) {
    return NextResponse.json({ message: "Accounting periods are unavailable." }, { status: statusFor(error) });
  }
}

export async function POST(request: Request, context: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await context.params;
    const access = await requestContext(request, businessId);
    const body = await request.json();
    return NextResponse.json({ period: await createAccountingPeriod(access, body.data ?? body) }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: "Check the period details.", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: messageFor(error) }, { status: statusFor(error) });
  }
}
