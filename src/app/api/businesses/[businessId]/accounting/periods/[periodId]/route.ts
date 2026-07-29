import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getAccountingPeriod,
  transitionAccountingPeriod,
  updateAccountingPeriod,
} from "@/modules/accounting/server/periods";
import { getRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";

async function requestContext(request: Request, businessId: string) {
  const session = await getRequestSession(request.headers);
  if (!session) throw new Error("AUTHENTICATION_REQUIRED");
  return requireBusinessAccessContext({ userId: session.user.id, businessId });
}

function errorCode(error: unknown) {
  return error instanceof Error ? error.message : "ACCOUNTING_PERIOD_CHANGE_FAILED";
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
  if (message.includes("ACCOUNTING_PERIOD_DATES_LOCKED")) return "Dates can be changed only while the period is open.";
  if (message.includes("ACCOUNTING_PERIOD_TRANSITION_INVALID")) return "That period status transition is not allowed.";
  if (message.includes("ACCOUNTING_PERIOD_TRANSITION_REASON_REQUIRED")) return "Enter a reason for the period status change.";
  return "The accounting period change could not be saved.";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ businessId: string; periodId: string }> },
) {
  try {
    const { businessId, periodId } = await context.params;
    const access = await requestContext(request, businessId);
    return NextResponse.json({ period: await getAccountingPeriod(access, periodId) });
  } catch (error) {
    return NextResponse.json({ message: "The accounting period is unavailable." }, { status: statusFor(error) });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ businessId: string; periodId: string }> },
) {
  try {
    const { businessId, periodId } = await context.params;
    const access = await requestContext(request, businessId);
    const body = await request.json();
    if (body.action === "transition") {
      return NextResponse.json({ period: await transitionAccountingPeriod(access, periodId, body.data) });
    }
    return NextResponse.json({ period: await updateAccountingPeriod(access, periodId, body.data ?? body) });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: "Check the period details.", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: messageFor(error) }, { status: statusFor(error) });
  }
}
