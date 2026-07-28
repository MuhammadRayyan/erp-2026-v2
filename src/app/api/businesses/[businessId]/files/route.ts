import { NextResponse } from "next/server";
import { getRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";
import { listStoredFiles, uploadPrivateFile } from "@/modules/files/server/files";

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "FILE_OPERATION_FAILED";
  if (message === "AUTHENTICATION_REQUIRED") return 401;
  if (message.includes("DENIED") || message.includes("DISABLED")) return 403;
  if (message.includes("NOT_FOUND")) return 404;
  if (message.includes("TOO_LARGE")) return 413;
  if (message.includes("NOT_ALLOWED") || message.includes("MISMATCH") || message.includes("EMPTY")) return 400;
  return 409;
}

async function accessFor(request: Request, businessId: string) {
  const session = await getRequestSession(request.headers);
  if (!session) throw new Error("AUTHENTICATION_REQUIRED");
  return requireBusinessAccessContext({ userId: session.user.id, businessId });
}

export async function GET(request: Request, context: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await context.params;
    return NextResponse.json({ files: await listStoredFiles(await accessFor(request, businessId)) });
  } catch (error) {
    return NextResponse.json({ message: "Files are unavailable." }, { status: statusFor(error) });
  }
}

export async function POST(request: Request, context: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await context.params;
    const access = await accessFor(request, businessId);
    const form = await request.formData();
    const uploaded = form.get("file");
    if (!(uploaded instanceof File)) return NextResponse.json({ message: "Choose a file to upload." }, { status: 400 });
    const bytes = new Uint8Array(await uploaded.arrayBuffer());
    const file = await uploadPrivateFile(access, {
      name: uploaded.name,
      contentType: uploaded.type || "application/octet-stream",
      bytes,
      entityType: String(form.get("entityType") || "BUSINESS"),
      entityId: String(form.get("entityId") || businessId),
      label: String(form.get("label") || ""),
    });
    return NextResponse.json({ file }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "File upload failed." }, { status: statusFor(error) });
  }
}
