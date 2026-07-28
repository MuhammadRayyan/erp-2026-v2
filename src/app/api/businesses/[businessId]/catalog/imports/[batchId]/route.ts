import { NextResponse } from "next/server";
import { getRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";
import { commitCatalogImport, getCatalogImport, resolveCatalogImportRow } from "@/modules/catalog/server/imports";

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "CATALOG_IMPORT_FAILED";
  if (message === "AUTHENTICATION_REQUIRED") return 401;
  if (message.includes("DENIED") || message.includes("DISABLED")) return 403;
  if (message.includes("NOT_FOUND")) return 404;
  if (message.includes("INVALID") || message.includes("UNRESOLVED") || message.includes("FINALIZED")) return 409;
  return 400;
}

async function accessFor(request: Request, businessId: string) {
  const session = await getRequestSession(request.headers);
  if (!session) throw new Error("AUTHENTICATION_REQUIRED");
  return requireBusinessAccessContext({ userId: session.user.id, businessId });
}

export async function GET(request: Request, context: { params: Promise<{ businessId: string; batchId: string }> }) {
  try {
    const { businessId, batchId } = await context.params;
    return NextResponse.json({ batch: await getCatalogImport(await accessFor(request, businessId), batchId) });
  } catch (error) {
    return NextResponse.json({ message: "Catalog import is unavailable." }, { status: statusFor(error) });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ businessId: string; batchId: string }> }) {
  try {
    const { businessId, batchId } = await context.params;
    const access = await accessFor(request, businessId);
    const body = await request.json();
    if (body.action === "commit") return NextResponse.json({ result: await commitCatalogImport(access, batchId) });
    if (body.action === "resolve") {
      if (!["CREATE", "UPDATE", "SKIP"].includes(body.resolution)) return NextResponse.json({ message: "Invalid resolution." }, { status: 400 });
      return NextResponse.json({ row: await resolveCatalogImportRow(access, batchId, String(body.rowId), body.resolution) });
    }
    return NextResponse.json({ message: "Unknown import action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Catalog import update failed." }, { status: statusFor(error) });
  }
}
