import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessPageAccess } from "@/modules/access/server/business-page";
import { listJournalEntries } from "@/modules/accounting/server/journals";

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function entryTotal(entry: Awaited<ReturnType<typeof listJournalEntries>>[number]) {
  const total = entry.lines.reduce((sum, line) => sum + Number(line.debit), 0);
  return total.toFixed(4);
}

export default async function JournalRegisterPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  let access;
  try {
    access = await requireBusinessPageAccess(businessId, "accounting.view", "accounting.core");
  } catch {
    notFound();
  }

  const entries = await listJournalEntries(access.context);

  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[var(--brand)]">Accounting kernel · journal evidence</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Posted journals</h1>
        <p className="mt-2 max-w-3xl text-[var(--muted)]">Read-only evidence for entries accepted by the central posting kernel. This page exposes posted history only; it does not create, edit, import, or delete financial transactions.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/business/${businessId}/accounting`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-medium">Chart</Link>
        <Link href={`/business/${businessId}/accounting/periods`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-medium">Periods</Link>
      </div>
    </div>

    <div className="rounded-2xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-4 text-sm">
      <p className="font-medium">No manual posting workflow</p>
      <p className="mt-1 text-[var(--muted)]">Opening balances, sales and purchase posting, VAT posting, allocations, reconciliation, financial statements, and ordinary manual journals remain blocked until their policies are implemented through the posting kernel.</p>
    </div>

    <section>
      <div className="flex items-center justify-between gap-4">
        <div><h2 className="text-xl font-semibold">Journal register</h2><p className="mt-1 text-sm text-[var(--muted)]">Latest posted entries, ordered by accounting date and posting time.</p></div>
        <span className="text-sm text-[var(--muted)]">{entries.length} posted entries</span>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {entries.length === 0 ? <div className="p-10 text-center text-sm text-[var(--muted)]">No journals have been posted for this business.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-[var(--muted)]"><tr><th className="px-4 py-3">Journal</th><th className="px-4 py-3">Accounting date</th><th className="px-4 py-3">Origin</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Lines</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">{entries.map((entry) => <tr key={entry.id}>
            <td className="px-4 py-4"><Link href={`/business/${businessId}/accounting/journals/${entry.id}`} className="font-medium text-[var(--brand)] hover:underline">{entry.id.slice(0, 8)}</Link><p className="mt-1 text-xs text-[var(--muted)]">Posted {entry.postedAt ? entry.postedAt.toISOString() : "inside transaction"}</p></td>
            <td className="px-4 py-4">{formatDate(entry.postingDate)}</td>
            <td className="px-4 py-4"><span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium">{label(entry.origin)}</span>{entry.reversalOfId && <p className="mt-1 text-xs text-[var(--muted)]">Reverses {entry.reversalOfId.slice(0, 8)}</p>}</td>
            <td className="px-4 py-4"><p>{entry.sourceType}</p><p className="text-xs text-[var(--muted)]">{entry.sourceId}</p></td>
            <td className="px-4 py-4">{entry.lines.length}</td>
            <td className="px-4 py-4 text-right font-medium tabular-nums">{entry.currencyCode} {entryTotal(entry)}</td>
            <td className="px-4 py-4 text-right font-medium tabular-nums">{entry.currencyCode} {entryTotal(entry)}</td>
          </tr>)}</tbody>
        </table></div>}
      </div>
    </section>
  </div>;
}
