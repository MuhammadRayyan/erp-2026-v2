const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const secret = process.env.OUTBOX_WORKER_SECRET;
const pollSeconds = Number(process.env.OUTBOX_POLL_SECONDS ?? 5);

if (!secret || secret.length < 32) {
  throw new Error("OUTBOX_WORKER_SECRET must contain at least 32 characters.");
}

const endpoint = new URL("/api/internal/outbox/process", appUrl).toString();
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

console.log(`Email worker polling ${endpoint}`);
for (;;) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    if (!response.ok) {
      console.error("Email worker request failed", response.status);
    }
  } catch (error) {
    console.error("Email worker request failed", error instanceof Error ? error.message : String(error));
  }
  await sleep(Math.max(2, pollSeconds) * 1000);
}
