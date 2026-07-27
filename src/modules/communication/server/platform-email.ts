import nodemailer from "nodemailer";
import { serverEnv } from "@/lib/server-env";

export type PlatformEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

export function escapeEmailHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getTransport() {
  if (!serverEnv.SMTP_HOST) {
    throw new Error("SMTP_NOT_CONFIGURED");
  }

  transport ??= nodemailer.createTransport({
    host: serverEnv.SMTP_HOST,
    port: serverEnv.SMTP_PORT,
    secure: serverEnv.SMTP_SECURE,
    auth: serverEnv.SMTP_USER && serverEnv.SMTP_PASSWORD
      ? { user: serverEnv.SMTP_USER, pass: serverEnv.SMTP_PASSWORD }
      : undefined,
  });

  return transport;
}

export async function sendPlatformEmail(message: PlatformEmail) {
  const result = await getTransport().sendMail({
    from: serverEnv.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  return { messageId: result.messageId };
}
