import { AcceptInvitation } from "@/components/tenancy/accept-invitation";
import { Card } from "@/components/ui/card";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="mx-auto max-w-xl py-12">
      <Card className="p-8">
        <p className="text-sm font-medium text-[var(--brand)]">Business invitation</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Join the tenant</h1>
        <p className="mt-3 text-[var(--muted)]">
          Accepting this invitation activates only the businesses and roles granted by the tenant owner. The signed-in email address must match the invitation.
        </p>
        <div className="mt-6">
          <AcceptInvitation token={token} />
        </div>
      </Card>
    </div>
  );
}
