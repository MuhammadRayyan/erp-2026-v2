import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { MemberAccessControls } from "@/components/tenancy/member-access-controls";
import { RevokeInvitationButton } from "@/components/tenancy/revoke-invitation-button";
import { InvitationForm } from "@/components/tenancy/invitation-form";
import { Card } from "@/components/ui/card";
import { requireRequestSession } from "@/modules/identity/server/session";
import { getBusinessRole } from "@/modules/access/roles";
import { listTenantAccessAdministration } from "@/modules/tenancy/server/invitations";

function eventLabel(value: string) {
  return value.toLowerCase().split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

function metadataDetails(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const values = metadata as Record<string, unknown>;
  const details: string[] = [];
  if (typeof values.previousRoleKey === "string" || typeof values.roleKey === "string") {
    details.push(`Role: ${String(values.previousRoleKey ?? "none").replace("business.", "")} → ${String(values.roleKey ?? "none").replace("business.", "")}`);
  }
  if (typeof values.previousStatus === "string" || typeof values.status === "string") {
    details.push(`Status: ${String(values.previousStatus ?? "none").toLowerCase()} → ${String(values.status ?? "none").toLowerCase()}`);
  }
  if (typeof values.count === "number") details.push(`Sessions removed: ${values.count}`);
  if (typeof values.source === "string") details.push(`Source: ${values.source.toLowerCase().replaceAll("_", " ")}`);
  return details;
}

export default async function TenantUsersPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const session = await requireRequestSession(await headers());
  const { tenantId } = await params;
  let administration;
  try {
    administration = await listTenantAccessAdministration({ actorUserId: session.user.id, tenantId });
  } catch {
    notFound();
  }

  return <div className="space-y-8">
    <div><p className="text-sm font-medium text-[var(--brand)]">Tenant administration</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Users and business access</h1><p className="mt-2 max-w-2xl text-[var(--muted)]">Manage who can enter {administration.name}, their tenant status, and their role in each business.</p></div>
    <InvitationForm tenantId={administration.id} businesses={administration.businesses} />
    <section>
      <div className="flex items-end justify-between gap-4"><div><h2 className="text-xl font-semibold">Members</h2><p className="mt-1 text-sm text-[var(--muted)]">Disabling a member removes business access and revokes active sessions immediately.</p></div><span className="text-sm text-[var(--muted)]">{administration.memberships.length} users</span></div>
      <div className="mt-4 grid gap-4">{administration.memberships.map((membership) => <Card key={membership.id}>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-semibold">{membership.user.name}</h3><p className="mt-1 text-sm text-[var(--muted)]">{membership.user.email}</p></div><div className="flex items-center gap-2">{membership.isOwner && <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-xs font-medium text-[var(--brand)]">Tenant owner</span>}<span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--muted)]">{membership.status.toLowerCase()}</span></div></div>
        <MemberAccessControls tenantId={administration.id} userId={membership.user.id} isOwner={membership.isOwner} memberStatus={membership.status} grants={membership.businesses.map((grant) => ({ businessId: grant.business.id, businessName: grant.business.legalName, roleKey: grant.roleKey, status: grant.status }))} />
      </Card>)}</div>
    </section>
    <section>
      <h2 className="text-xl font-semibold">Pending invitations</h2>
      <div className="mt-4 grid gap-4">{administration.invitations.length === 0 ? <Card className="border-dashed text-sm text-[var(--muted)]">No invitations are waiting for acceptance.</Card> : administration.invitations.map((invitation) => <Card key={invitation.id}>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-semibold">{invitation.email}</h3><p className="mt-1 text-sm text-[var(--muted)]">Expires {invitation.expiresAt.toLocaleDateString("en-US")}</p><p className="mt-2 text-sm text-[var(--muted)]">{invitation.businessGrants.map((grant) => `${grant.business.legalName} · ${getBusinessRole(grant.roleKey)?.label ?? grant.roleKey}`).join(", ")}</p><p className="mt-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Email: {invitation.delivery?.status.toLowerCase() ?? "not queued"}{invitation.delivery && invitation.delivery.attempts > 0 ? ` · ${invitation.delivery.attempts} attempt${invitation.delivery.attempts === 1 ? "" : "s"}` : ""}</p>{invitation.delivery?.status === "FAILED" && <p className="mt-1 text-sm text-[var(--danger)]">Delivery failed after all retries. Create a new invitation after checking SMTP.</p>}</div><RevokeInvitationButton tenantId={administration.id} invitationId={invitation.id} /></div>
      </Card>)}</div>
    </section>
    <section>
      <div className="flex items-end justify-between gap-4"><div><h2 className="text-xl font-semibold">Access history</h2><p className="mt-1 text-sm text-[var(--muted)]">Immutable invitation, membership, business-role, and session-revocation events visible only to tenant owners.</p></div><span className="text-sm text-[var(--muted)]">Latest {administration.accessEvents.length}</span></div>
      <div className="mt-4 grid gap-4">{administration.accessEvents.length === 0 ? <Card className="border-dashed text-sm text-[var(--muted)]">No access events recorded yet.</Card> : administration.accessEvents.map((event) => {
        const details = metadataDetails(event.metadata);
        return <Card key={event.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">{eventLabel(event.eventType)}</span><h3 className="font-semibold">{event.summary}</h3></div>
              <p className="mt-2 text-sm text-[var(--muted)]">Target: {event.targetUser?.name ? `${event.targetUser.name} · ` : ""}{event.targetEmail}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Actor: {event.actor ? `${event.actor.name} · ${event.actor.email}` : "System"}{event.business ? ` · Business: ${event.business.tradingName || event.business.legalName}` : ""}</p>
              {details.length > 0 && <p className="mt-2 text-xs text-[var(--muted)]">{details.join(" · ")}</p>}
            </div>
            <time className="text-xs text-[var(--muted)]" dateTime={event.occurredAt.toISOString()}>{event.occurredAt.toISOString()}</time>
          </div>
        </Card>;
      })}</div>
    </section>
  </div>;
}
