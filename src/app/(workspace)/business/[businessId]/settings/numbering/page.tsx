import Link from "next/link";
import { notFound } from "next/navigation";
import { NumberSequenceForm } from "@/components/numbering/number-sequence-form";
import { hasBusinessCapability } from "@/modules/access/roles";
import { requireBusinessPageAccess } from "@/modules/access/server/business-page";
import { listNumberSequences } from "@/modules/numbering/server/numbering";

export default async function NumberingSettingsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  let access;
  try {
    access = await requireBusinessPageAccess(businessId, "settings.view", "core.settings");
  } catch {
    notFound();
  }
  const sequences = await listNumberSequences(access.context);
  const editable = hasBusinessCapability(access.context.roleKey, "settings.manage");

  return <div className="space-y-7">
    <div>
      <Link href={`/business/${businessId}/settings`} className="text-sm font-medium text-[var(--brand)] hover:underline">← Business settings</Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Document numbering</h1>
      <p className="mt-2 max-w-3xl text-[var(--muted)]">Configure future document identifiers. Allocations are idempotent, concurrency-safe, date-aware, and never reused after voiding.</p>
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      {sequences.map((sequence) => <NumberSequenceForm key={sequence.id} businessId={businessId} sequence={{ ...sequence, allocations: sequence.allocations.map((allocation) => ({ ...allocation, effectiveDate: allocation.effectiveDate.toISOString(), createdAt: allocation.createdAt.toISOString() })) }} editable={editable} />)}
    </div>
  </div>;
}
