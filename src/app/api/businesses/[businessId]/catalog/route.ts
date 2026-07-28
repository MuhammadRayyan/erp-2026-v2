import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";
import { createCatalogItem, createUnit, listCatalogItems, listUnits, setCatalogItemStatus } from "@/modules/catalog/server/catalog";

async function requestContext(request: Request, businessId: string) {
  const session = await getRequestSession(request.headers);
  if (!session) throw new Error("AUTHENTICATION_REQUIRED");
  return requireBusinessAccessContext({ userId: session.user.id, businessId });
}

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "CATALOG_UNAVAILABLE";
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
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const [items, units] = await Promise.all([
      listCatalogItems(access, {
        query: url.searchParams.get("q") ?? undefined,
        type: type === "PRODUCT" || type === "SERVICE" ? type : undefined,
        status: status === "ACTIVE" || status === "INACTIVE" ? status : undefined,
      }),
      listUnits(access),
    ]);
    return NextResponse.json({ items, units });
  } catch (error) {
    return NextResponse.json({ message: "Catalog is unavailable." }, { status: statusFor(error) });
  }
}

export async function POST(request: Request, context: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await context.params;
    const access = await requestContext(request, businessId);
    const body = await request.json();
    if (body.action === "create-unit") {
      return NextResponse.json({ unit: await createUnit(access, body.data) }, { status: 201 });
    }
    if (body.action === "set-status") {
      return NextResponse.json({ item: await setCatalogItemStatus(access, body.itemId, body.data) });
    }
    return NextResponse.json({ item: await createCatalogItem(access, body.data ?? body) }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: "Check the catalog details.", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: "The catalog change could not be saved." }, { status: statusFor(error) });
  }
}
