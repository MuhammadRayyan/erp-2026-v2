import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  createCustomFieldDefinition,
  getCustomFieldsForEntity,
  listCustomFieldDefinitions,
  saveCustomFieldValues,
  updateCustomFieldDefinition,
} from "@/modules/custom-fields/server/custom-fields";
import { getRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";

async function requestContext(request: Request, businessId: string) {
  const session = await getRequestSession(request.headers);
  if (!session) throw new Error("AUTHENTICATION_REQUIRED");
  return requireBusinessAccessContext({ userId: session.user.id, businessId });
}

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "CUSTOM_FIELDS_UNAVAILABLE";
  if (message === "AUTHENTICATION_REQUIRED") return 401;
  if (message.includes("DENIED") || message.includes("DISABLED")) return 403;
  if (message.includes("NOT_FOUND")) return 404;
  if (message.includes("REQUIRED") || message.includes("INVALID") || message.includes("DUPLICATE")) return 400;
  return 409;
}

export async function GET(request: Request, context: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await context.params;
    const access = await requestContext(request, businessId);
    const url = new URL(request.url);
    const entityType = url.searchParams.get("entityType") ?? undefined;
    const entityId = url.searchParams.get("entityId") ?? undefined;
    if (entityId && entityType) return NextResponse.json({ fields: await getCustomFieldsForEntity(access, entityType, entityId) });
    return NextResponse.json({ definitions: await listCustomFieldDefinitions(access, entityType) });
  } catch (error) {
    return NextResponse.json({ message: "Custom fields are unavailable." }, { status: statusFor(error) });
  }
}

export async function POST(request: Request, context: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await context.params;
    const access = await requestContext(request, businessId);
    const body = await request.json();
    if (body.action === "create-definition") return NextResponse.json({ definition: await createCustomFieldDefinition(access, body.data) }, { status: 201 });
    if (body.action === "update-definition") return NextResponse.json({ definition: await updateCustomFieldDefinition(access, body.definitionId, body.data) });
    if (body.action === "save-values") return NextResponse.json({ result: await saveCustomFieldValues(access, body.entityType, body.entityId, body.data) });
    return NextResponse.json({ message: "Unsupported custom-field action." }, { status: 400 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ message: "Check the custom-field details.", issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : "CUSTOM_FIELD_CHANGE_FAILED";
    const responseMessage = message === "CUSTOM_FIELD_OPTION_IN_USE"
      ? "An option already used by records cannot be removed. Deactivate the field or keep that option."
      : message === "CUSTOM_FIELD_REQUIRED"
        ? "Complete all required custom fields."
        : "The custom-field change could not be saved.";
    return NextResponse.json({ message: responseMessage }, { status: statusFor(error) });
  }
}
