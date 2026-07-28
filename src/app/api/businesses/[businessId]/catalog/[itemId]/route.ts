import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";
import { getCatalogItem, setCatalogItemStatus, updateCatalogItem } from "@/modules/catalog/server/catalog";

async function requestContext(request: Request, businessId: string) {
  const session = await getRequestSession(request.headers);
  if (!session) throw new Error("AUTHENTICATION_REQUIRED");
  return requireBusinessAccessContext({ userId: session.user.id, businessId });
}

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "CATALOG_ITEM_UNAVAILABLE";
  if (message === "AUTHENTICATION_REQUIRED") return 401;
  if (message.includes("DENIED") || message.includes("DISABLED")) return 403;
  if (message.includes("NOT_FOUND")) return 404;
  return 409;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ businessId: string; itemId: string }> },
) {
  try {
    const { businessId, itemId } = await context.params;
    const access = await requestContext(request, businessId);
    return NextResponse.json({ item: await getCatalogItem(access, itemId) });
  } catch (error) {
    return NextResponse.json({ message: "Catalog item is unavailable." }, { status: statusFor(error) });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ businessId: string; itemId: string }> },
) {
  try {
    const { businessId, itemId } = await context.params;
    const access = await requestContext(request, businessId);
    const body = await request.json();
    const item = body.action === "status"
      ? await setCatalogItemStatus(access, itemId, body.data ?? body)
      : await updateCatalogItem(access, itemId, body.data ?? body);
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: "Check the catalog details.", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: "The catalog item could not be updated." }, { status: statusFor(error) });
  }
}
