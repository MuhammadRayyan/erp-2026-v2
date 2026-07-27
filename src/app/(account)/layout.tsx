import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/layout/account-shell";
import { getRequestSession } from "@/modules/identity/server/session";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getRequestSession(await headers());

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <AccountShell user={{ name: session.user.name, email: session.user.email }}>
      {children}
    </AccountShell>
  );
}
