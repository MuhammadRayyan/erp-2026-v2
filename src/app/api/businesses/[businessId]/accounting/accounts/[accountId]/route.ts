import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getLedgerAccount, setLedgerAccountStatus, updateLedgerAccount } from "@/modules/accounting/server/accounts";
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

function messageFor(error: unknown) {
  const message = error instanceof Error ? error.message : "LEDGER_ACCOUNT_CHANGE_FAILED";
  if (message === "LEDGER_ACCOUNT_REQUIRED") return "Required system accounts cannot be deactivated.";
  if (message === "LEDGER_ACCOUNT_ACTIVE_CHILDREN") return "Deactivate or move active child accounts first.";
  if (message === "LEDGER_ACCOUNT_SYSTEM_STRUCTURE_IMMUTABLE") return "The structural classification of a system account cannot be changed.";
  if (message === "LEDGER_ACCOUNT_PARENT_NOT_HEADER") return "Choose a header account as the parent.";
  if (message === "LEDGER_ACCOUNT_PARENT_CLASS_MISMATCH") return "The parent and child must belong to the same account class.";
  if (message === "LEDGER_ACCOUNT_PARENT_INACTIVE") return "Activate the parent account first.";
  return "The account change could not be saved.";
}

export async function GET(request: Request, context: { params: Promise<{ businessId: string; accountId: string }> }) {
  try {
    const { businessId, accountId } = await context.params;
    const access = await requestContext(request, businessId);
    return NextResponse.json({ account: await getLedgerAccount(access, accountId) });
  } catch (error) {
    return NextResponse.json({ message: "The account is unavailable." }, { status: statusFor(error) });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ businessId: string; accountId: string }> }) {
  try {
    const { businessId, accountId } = await context.params;
    const access = await requestContext(request, businessId);
    const body = await request.json();
    if (body.action === "status") {
      return NextResponse.json({ account: await setLedgerAccountStatus(access, accountId, body.data) });
    }
    return NextResponse.json({ account: await updateLedgerAccount(access, accountId, body.data ?? body) });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: "Check the account details.", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: messageFor(error) }, { status: statusFor(error) });
  }
}