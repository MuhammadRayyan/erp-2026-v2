import { NextResponse } from "next/server";
import { getRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";
import { previewCatalogImport } from "@/modules/catalog/server/imports";

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "CATALOG_IMPORT_FAILED";
  if (message === "AUTHENTICATION_REQUIRED") return 401;
  if (message.includes("DENIED") || message.includes("DISABLED")) return 403;
  if (message.includes("TOO_LARGE")) return 413;
  if (message.includes("EMPTY") || message.includes("HEADERS") || message.includes("QUOTE")) return 400;
  return 409;
}

export async function POST(request: Request, context: { params: Promise<{ businessId: string }> }) {
  try {
    const session = await getRequestSession(request.headers);
    if (!session) throw new Error("AUTHENTICATION_REQUIRED");
    const { businessId } = await context.params;
    const access = await requireBusinessAccessContext({ userId: session.user.id, businessId });
    const body = await request.json();
    const batch = await previewCatalogImport(access, { sourceName: String(body.sourceName ?? "catalog.csv"), csv: String(body.csv ?? "") });
    return NextResponse.json({ batch }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Catalog import preview failed." }, { status: statusFor(error) });
  }
}
