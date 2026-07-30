import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { postOpeningBalances } from "@/modules/accounting/server/opening-balances";
import { getRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";

async function requestContext(request: Request, businessId: string) {
  const session = await getRequestSession(request.headers);
  if (!session) throw new Error("AUTHENTICATION_REQUIRED");
  return requireBusinessAccessContext({ userId: session.user.id, businessId });
}

function errorCode(error: unknown) {
  return error instanceof Error ? error.message : "OPENING_BALANCE_UNAVAILABLE";
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
  if (message.includes("JOURNAL_ENTRY_SOURCE_ALREADY_POSTED")) return "Opening balances have already been posted for this business.";
  if (message.includes("JOURNAL_ENTRY_IDEMPOTENCY_CONFLICT")) return "This idempotency key was already used with different opening-balance details.";
  if (message.includes("ACCOUNTING_PERIOD_NOT_OPEN")) return "The cutover date must be inside an open accounting period.";
  if (message.includes("ACCOUNTING_PERIOD_REQUIRED")) return "Create an open accounting period that covers the cutover date before posting opening balances.";
  if (message.includes("OPENING_BALANCE_EQUITY_ACCOUNT_NOT_AVAILABLE")) return "The required owner-capital balancing account is unavailable.";
  if (message.includes("OPENING_BALANCE_ACCOUNT")) return "One or more selected accounts are not eligible for controlled opening balances.";
  return "Opening balances could not be posted.";
}

export async function POST(request: Request, context: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await context.params;
    const access = await requestContext(request, businessId);
    const body = await request.json();
    return NextResponse.json({ journal: await postOpeningBalances(access, body.data ?? body) }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: "Check the opening-balance details.", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: messageFor(error) }, { status: statusFor(error) });
  }
}
