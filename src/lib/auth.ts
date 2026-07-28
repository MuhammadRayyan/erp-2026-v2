import { createHash } from "node:crypto";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { EmailOutboxCategory } from "@/generated/prisma/client";
import { enqueueEmail } from "@/modules/communication/server/email-outbox";
import { db } from "./db";
import { serverEnv } from "./server-env";

export const auth = betterAuth({
  appName: "ERP 2026",
  baseURL: serverEnv.BETTER_AUTH_URL,
  secret: serverEnv.BETTER_AUTH_SECRET,
  trustedOrigins: [serverEnv.APP_URL],
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const urlDigest = createHash("sha256").update(url).digest("hex");
      await enqueueEmail(db, {
        category: EmailOutboxCategory.PASSWORD_RESET,
        recipient: user.email,
        subject: "Reset your ERP 2026 password",
        textBody: `Use this link within one hour to reset your ERP 2026 password: ${url}`,
        htmlBody: `<p>Use the link below within one hour to reset your ERP 2026 password.</p><p><a href="${url}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
        idempotencyKey: `password-reset:${user.id}:${urlDigest}`,
        correlationType: "PASSWORD_RESET_USER",
        correlationId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        maxAttempts: 5,
      });
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  verification: { storeIdentifier: "hashed" },
  advanced: { useSecureCookies: serverEnv.NODE_ENV === "production" },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
