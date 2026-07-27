import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { sendPlatformEmail } from "@/modules/communication/server/platform-email";
import { db } from "./db";
import { serverEnv } from "./server-env";

export const auth = betterAuth({
  appName: "ERP 2026",
  baseURL: serverEnv.BETTER_AUTH_URL,
  secret: serverEnv.BETTER_AUTH_SECRET,
  trustedOrigins: [serverEnv.APP_URL],
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      void sendPlatformEmail({
        to: user.email,
        subject: "Reset your ERP 2026 password",
        text: `Use this link within one hour to reset your ERP 2026 password: ${url}`,
        html: `<p>Use the link below within one hour to reset your ERP 2026 password.</p><p><a href="${url}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
      }).catch((error) => {
        console.error("Password reset email delivery failed", {
          userId: user.id,
          error: error instanceof Error ? error.message : "Unknown email error",
        });
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  verification: {
    storeIdentifier: "hashed",
  },
  advanced: {
    useSecureCookies: serverEnv.NODE_ENV === "production",
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
