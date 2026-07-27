import { auth, type AuthSession } from "@/lib/auth";

export async function getRequestSession(requestHeaders: Headers): Promise<AuthSession | null> {
  return auth.api.getSession({ headers: requestHeaders });
}

export async function requireRequestSession(requestHeaders: Headers): Promise<AuthSession> {
  const session = await getRequestSession(requestHeaders);

  if (!session) {
    throw new Error("AUTHENTICATION_REQUIRED");
  }

  return session;
}
