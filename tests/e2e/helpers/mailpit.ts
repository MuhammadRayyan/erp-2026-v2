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

function messageLinks(message: MailpitMessage) {
  const textLinks = message.Text.match(/https?:\/\/[^\s<>"']+/g) ?? [];
  const htmlLinks = Array.from(message.HTML.matchAll(/href=["']([^"']+)["']/gi), (match) => match[1].replaceAll("&amp;", "&"));
  return Array.from(new Set([...textLinks, ...htmlLinks]));
}

function targetsApplicationPath(url: URL, pathPrefix: string, origin: string) {
  if (url.origin !== origin) return false;
  if (url.pathname.startsWith(pathPrefix)) return true;

  for (const value of url.searchParams.values()) {
    try {
      const redirect = new URL(value, origin);
      if (redirect.origin === origin && redirect.pathname.startsWith(pathPrefix)) return true;
    } catch {
      // Ignore non-URL query parameters such as opaque verification tokens.
    }
  }
  return false;
}

export function applicationLink(message: MailpitMessage, pathPrefix: string, applicationUrl: string) {
  const origin = new URL(applicationUrl).origin;
  const link = messageLinks(message).find((candidate) => {
    try {
      return targetsApplicationPath(new URL(candidate), pathPrefix, origin);
    } catch {
      return false;
    }
  });
  if (!link) throw new Error(`Email did not contain a same-origin link targeting ${pathPrefix}.`);
  return link;
}
