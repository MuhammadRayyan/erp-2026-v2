import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { AccountClass, AccountStatus } from "@/generated/prisma/client";
import { accountClasses, accountStatuses } from "@/modules/accounting/contracts/accounts";
import { createLedgerAccount, listLedgerAccounts } from "@/modules/accounting/server/accounts";
import { getRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";

async function requestContext(request: Request, businessId: string) {
  const session = await getRequestSession(request.headers);
  if (!session) throw new Error("AUTHENTICATION_REQUIRED");
  return requireBusinessAccessContext({ userId: session.user.id, businessId });
}

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "ACCOUNTING_UNAVAILABLE";
  if (message === "AUTHENTICATION_REQUIRED") return 401;
  if (message.includes("DENIED") || message.includes("DISABLED")) return 403;
  if (message.includes("NOT_FOUND")) return 404;
  return 409;
}

export async function GET(request: Request, context: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await context.params;
    const access = await requestContext(request, businessId);
    const url = new URL(request.url);
    const accountClass = url.searchParams.get("class");
    const status = url.searchParams.get("status");
    const accounts = await listLedgerAccounts(access, {
      query: url.searchParams.get("q") ?? undefined,
      class: accountClasses.includes(accountClass as AccountClass) ? accountClass as AccountClass : undefined,
      status: accountStatuses.includes(status as AccountStatus) ? status as AccountStatus : undefined,
    });
    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json({ message: "The chart of accounts is unavailable." }, { status: statusFor(error) });
  }
}

export async function POST(request: Request, context: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await context.params;
    const access = await requestContext(request, businessId);
    const body = await request.json();
    return NextResponse.json({ account: await createLedgerAccount(access, body.data ?? body) }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: "Check the account details.", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: "The account could not be created." }, { status: statusFor(error) });
  }
}