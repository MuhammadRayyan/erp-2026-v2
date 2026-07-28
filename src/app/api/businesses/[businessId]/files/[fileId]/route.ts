import { getRequestSession } from "@/modules/identity/server/session";
import { requireBusinessAccessContext } from "@/modules/tenancy/server/context";
import { readPrivateFile } from "@/modules/files/server/files";

function disposition(name: string) {
  const ascii = name.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(request: Request, context: { params: Promise<{ businessId: string; fileId: string }> }) {
  try {
    const { businessId, fileId } = await context.params;
    const session = await getRequestSession(request.headers);
    if (!session) return Response.json({ message: "Authentication required." }, { status: 401 });
    const access = await requireBusinessAccessContext({ userId: session.user.id, businessId });
    const { file, bytes } = await readPrivateFile(access, fileId);
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": disposition(file.safeName),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "FILE_DOWNLOAD_FAILED";
    const status = message.includes("DENIED") || message.includes("DISABLED") ? 403 : message.includes("NOT_FOUND") ? 404 : 409;
    return Response.json({ message: "File is unavailable." }, { status });
  }
}
