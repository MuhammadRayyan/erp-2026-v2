import Link from "next/link";
import { notFound } from "next/navigation";
import { PartyDuplicateReviewPanel } from "@/components/parties/party-duplicate-review-panel";
import { requireBusinessPageAccess } from "@/modules/access/server/business-page";
import { hasBusinessCapability } from "@/modules/access/roles";
import { listPartyDuplicateReviews } from "@/modules/parties/server/duplicates";

export default async function PartyDuplicateReviewsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  let access;
  try {
    access = await requireBusinessPageAccess(businessId, "parties.view", "parties.core");
  } catch {
    notFound();
  }

  const reviews = await listPartyDuplicateReviews(access.context);
  const canManage = hasBusinessCapability(access.context.roleKey, "parties.manage");

  return <div className="space-y-8">
    <div><Link href={`/business/${businessId}/parties`} className="text-sm font-medium text-[var(--brand)]">← Customers and suppliers</Link><h1 className="mt-2 text-3xl font-semibold tracking-tight">Duplicate review</h1><p className="mt-2 max-w-3xl text-[var(--muted)]">Review exact identifier matches and similar names before future consolidation. No party, contact, address, role, or historical reference is changed here.</p></div>
    <PartyDuplicateReviewPanel businessId={businessId} reviews={JSON.parse(JSON.stringify(reviews))} canManage={canManage} />
  </div>;
}
