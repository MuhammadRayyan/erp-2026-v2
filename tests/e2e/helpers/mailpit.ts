const mailpitUrl = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";

type Address = { Address: string; Name?: string };
type MessageSummary = { ID: string; Subject: string; To: Address[] };
type MessageList = { messages?: MessageSummary[] };
export type MailpitMessage = MessageSummary & { Text: string; HTML: string };

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function clearMailbox(timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${mailpitUrl}/api/v1/messages`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (response.ok) return;
    } catch {
      // Mailpit may still be starting in a clean CI service container.
    }
    await sleep(500);
  }
  throw new Error("Mailpit did not become ready for mailbox cleanup.");
}

export async function waitForMessage(recipient: string, subjectIncludes: string, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${mailpitUrl}/api/v1/messages?limit=100`);
      if (response.ok) {
        const list = await response.json() as MessageList;
        const summary = list.messages?.find((message) =>
          message.Subject.includes(subjectIncludes)
          && message.To.some((address) => address.Address.toLowerCase() === recipient.toLowerCase()),
        );
        if (summary) {
          const detail = await fetch(`${mailpitUrl}/api/v1/message/${encodeURIComponent(summary.ID)}`);
          if (!detail.ok) throw new Error(`Mailpit message lookup failed with ${detail.status}.`);
          return await detail.json() as MailpitMessage;
        }
      }
    } catch {
      // Retry transient Mailpit startup or network failures until the deadline.
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for email to ${recipient} with subject containing ${subjectIncludes}.`);
}

export function applicationLink(message: MailpitMessage, pathPrefix: string, applicationUrl: string) {
  const origin = new URL(applicationUrl).origin;
  const links = message.Text.match(/https?:\/\/[^\s<>"']+/g) ?? [];
  const link = links.find((candidate) => {
    try {
      const url = new URL(candidate);
      return url.origin === origin && url.pathname.startsWith(pathPrefix);
    } catch {
      return false;
    }
  });
  if (!link) throw new Error(`Email did not contain an application link beginning with ${pathPrefix}.`);
  return link;
}
