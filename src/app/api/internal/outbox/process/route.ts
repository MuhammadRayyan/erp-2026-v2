import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server-env";
import { processEmailOutboxBatch } from "@/modules/communication/server/email-outbox";

export async function POST(request: Request) {
  const secret = serverEnv.OUTBOX_WORKER_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  const result = await processEmailOutboxBatch({ batchSize: serverEnv.OUTBOX_BATCH_SIZE });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
