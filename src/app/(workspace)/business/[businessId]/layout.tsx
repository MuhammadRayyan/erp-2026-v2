import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { BusinessShell } from "@/components/layout/business-shell";
import { getRequestSession } from "@/modules/identity/server/session";
import { resolveBusinessAccessContext } from "@/modules/tenancy/server/context";

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessId: string }>;
}) {
  const session = await getRequestSession(await headers());

  if (!session) {
    redirect("/sign-in");
  }

  const { businessId } = await params;
  const context = await resolveBusinessAccessContext({
    userId: session.user.id,
    businessId,
  });

  if (!context) {
    notFound();
  }

  return (
    <BusinessShell
      context={context}
      user={{ name: session.user.name, email: session.user.email }}
    >
      {children}
    </BusinessShell>
  );
}
