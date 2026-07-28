import Link from "next/link";
import { notFound } from "next/navigation";
import { PartyDetailEditor } from "@/components/parties/party-detail-editor";
import { requireBusinessPageAccess } from "@/modules/access/server/business-page";
import { hasBusinessCapability } from "@/modules/access/roles";
import { getParty } from "@/modules/parties/server/parties";

export default async function PartyDetailPage({ params }: { params: Promise<{ businessId: string; partyId: string }> }) {
  const { businessId, partyId } = await params;
  let access;
  try {
    access = await requireBusinessPageAccess(businessId, "parties.view", "parties.core");
  } catch {
    notFound();
  }

  let party;
  try {
    party = await getParty(access.context, partyId);
  } catch {
    notFound();
  }
  const canManage = hasBusinessCapability(access.context.roleKey, "parties.manage");
  const serialized = JSON.parse(JSON.stringify(party));

  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><Link href={`/business/${businessId}/parties`} className="text-sm font-medium text-[var(--brand)]">← Customers and suppliers</Link><h1 className="mt-2 text-3xl font-semibold tracking-tight">{party.displayName}</h1><p className="mt-2 text-[var(--muted)]">Manage identity, roles, lifecycle, contacts, and addresses from one business-scoped record.</p></div>
      <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-medium text-[var(--muted)]">{party.status.toLowerCase()}</span>
    </div>
    <PartyDetailEditor businessId={businessId} party={serialized} canManage={canManage} />
  </div>;
}
