import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessPageAccess } from "@/modules/access/server/business-page";
import { getJournalEntry } from "@/modules/accounting/server/journals";

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDateTime(value: Date | null) {
  return value ? value.toISOString() : "Recorded inside posting transaction";
}

function money(value: unknown) {
  if (value && typeof value === "object" && "toFixed" in value && typeof value.toFixed === "function") {
    return value.toFixed(4);
  }
  return Number(value).toFixed(4);
}

export default async function JournalDetailPage({ params }: { params: Promise<{ businessId: string; journalId: string }> }) {
  const { businessId, journalId } = await params;
  let access;
  try {
    access = await requireBusinessPageAccess(businessId, "accounting.view", "accounting.core");
  } catch {
    notFound();
  }

  let entry;
  try {
    entry = await getJournalEntry(access.context, journalId);
  } catch {
    notFound();
  }

  const totalDebit = entry.lines.reduce((sum, line) => sum + Number(line.debit), 0).toFixed(4);
  const totalCredit = entry.lines.reduce((sum, line) => sum + Number(line.credit), 0).toFixed(4);

  return <div className="space-y-8">
    <div>
      <Link href={`/business/${businessId}/accounting/journals`} className="text-sm font-medium text-[var(--brand)] hover:underline">Back to posted journals</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--brand)]">{label(entry.origin)} · {entry.sourceType}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Journal {entry.id.slice(0, 8)}</h1>
          <p className="mt-2 max-w-3xl text-[var(--muted)]">{entry.memo || "No journal memo."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-sm">{label(entry.status)}</span>
          <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-sm">{entry.currencyCode}</span>
          {entry.reversalOfId && <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-sm text-[var(--brand)]">Reversal</span>}
        </div>
      </div>
    </div>

    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"><p className="text-sm text-[var(--muted)]">Accounting date</p><p className="mt-2 text-lg font-semibold">{formatDate(entry.postingDate)}</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"><p className="text-sm text-[var(--muted)]">Posted at</p><p className="mt-2 text-lg font-semibold">{formatDateTime(entry.postedAt)}</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"><p className="text-sm text-[var(--muted)]">Source</p><p className="mt-2 text-lg font-semibold">{entry.sourceType}</p><p className="mt-1 break-all text-xs text-[var(--muted)]">{entry.sourceId}</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"><p className="text-sm text-[var(--muted)]">Idempotency key</p><p className="mt-2 break-all text-sm font-semibold">{entry.idempotencyKey}</p></div>
    </section>

    {(entry.reversalOf || entry.reversedBy) && <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <h2 className="text-xl font-semibold">Reversal lineage</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {entry.reversalOf && <div><p className="text-sm text-[var(--muted)]">This journal reverses</p><Link href={`/business/${businessId}/accounting/journals/${entry.reversalOf.id}`} className="mt-1 inline-block font-medium text-[var(--brand)] hover:underline">{entry.reversalOf.id.slice(0, 8)} · {formatDate(entry.reversalOf.postingDate)}</Link></div>}
        {entry.reversedBy && <div><p className="text-sm text-[var(--muted)]">Reversed by</p><Link href={`/business/${businessId}/accounting/journals/${entry.reversedBy.id}`} className="mt-1 inline-block font-medium text-[var(--brand)] hover:underline">{entry.reversedBy.id.slice(0, 8)} · {formatDate(entry.reversedBy.postingDate)}</Link></div>}
      </div>
    </section>}

    <section>
      <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-semibold">Journal lines</h2><p className="mt-1 text-sm text-[var(--muted)]">Posted lines are immutable. Corrections must use linked reversal or replacement entries through controlled workflows.</p></div><span className="text-sm text-[var(--muted)]">{entry.lines.length} lines</span></div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-[var(--muted)]"><tr><th className="px-4 py-3">Line</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">{entry.lines.map((line) => <tr key={line.id}>
            <td className="px-4 py-4">{line.lineNumber}</td>
            <td className="px-4 py-4"><Link href={`/business/${businessId}/accounting/${line.accountId}`} className="font-medium text-[var(--brand)] hover:underline">{line.account.code} · {line.account.name}</Link></td>
            <td className="px-4 py-4 text-[var(--muted)]">{line.description || "No line description"}</td>
            <td className="px-4 py-4 text-right tabular-nums">{money(line.debit)}</td>
            <td className="px-4 py-4 text-right tabular-nums">{money(line.credit)}</td>
          </tr>)}</tbody>
          <tfoot className="border-t border-[var(--border)] bg-[var(--surface-muted)] font-semibold"><tr><td className="px-4 py-3" colSpan={3}>Total</td><td className="px-4 py-3 text-right tabular-nums">{entry.currencyCode} {totalDebit}</td><td className="px-4 py-3 text-right tabular-nums">{entry.currencyCode} {totalCredit}</td></tr></tfoot>
        </table></div>
      </div>
    </section>
  </div>;
}
