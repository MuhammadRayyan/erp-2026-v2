import { getRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";
import { generateExport } from "@/modules/exports/server/exports";

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "EXPORT_FAILED";
  if (message === "AUTHENTICATION_REQUIRED") return 401;
  if (message.includes("DENIED") || message.includes("DISABLED")) return 403;
  if (message.includes("NOT_FOUND")) return 404;
  if (message.includes("ROW_LIMIT")) return 413;
  return 400;
}

function responseBody(bytes: Buffer) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function POST(request: Request, context: { params: Promise<{ businessId: string; dataset: string }> }) {
  try {
    const { businessId, dataset } = await context.params;
    const session = await getRequestSession(request.headers);
    if (!session) return Response.json({ message: "Authentication required." }, { status: 401 });
    const access = await requireBusinessAccessContext({ userId: session.user.id, businessId });
    const form = await request.formData();
    const filters = Object.fromEntries(Array.from(form.entries()).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    const { run, bytes } = await generateExport(access, dataset, filters);
    return new Response(responseBody(bytes), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${run.fileName}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Export-Run-Id": run.id,
        "X-Export-SHA256": run.sha256,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "EXPORT_FAILED";
    return Response.json({ message }, { status: statusFor(error) });
  }
}
