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
  return value ? value.toISOString() : "Inside posting transaction";
}

type JournalEntry = Awaited<ReturnType<typeof getJournalEntry>>;

function entryTotal(entry: JournalEntry) {
  const total = entry.lines.reduce((sum, line) => sum + Number(line.debit), 0);
  return total.toFixed(4);
}

export default async function JournalEntryDetailPage({ params }: { params: Promise<{ businessId: string; journalEntryId: string }> }) {
  const { businessId, journalEntryId } = await params;
  let access;
  try {
    access = await requireBusinessPageAccess(businessId, "accounting.view", "accounting.core");
  } catch {
    notFound();
  }

  let entry: JournalEntry;
  try {
    entry = await getJournalEntry(access.context, journalEntryId);
  } catch {
    notFound();
  }

  const total = entryTotal(entry);

  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[var(--brand)]">Accounting kernel · journal evidence</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Journal {entry.id.slice(0, 8)}</h1>
        <p className="mt-2 max-w-3xl text-[var(--muted)]">Immutable posted evidence accepted by the central posting kernel. This page is read-only and does not expose manual journal entry.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/business/${businessId}/accounting/journals`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-medium">Journal register</Link>
        <Link href={`/business/${businessId}/accounting`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-medium">Chart</Link>
      </div>
    </div>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm text-[var(--muted)]">Accounting date</p>
        <p className="mt-1 text-lg font-semibold">{formatDate(entry.postingDate)}</p>
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm text-[var(--muted)]">Posted at</p>
        <p className="mt-1 break-words text-lg font-semibold">{formatDateTime(entry.postedAt)}</p>
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm text-[var(--muted)]">Origin</p>
        <p className="mt-1 text-lg font-semibold">{label(entry.origin)}</p>
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm text-[var(--muted)]">Total</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">{entry.currencyCode} {total}</p>
      </div>
    </section>

    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-sm text-[var(--muted)]">Source</p>
          <p className="mt-1 font-medium">{entry.sourceType}</p>
          <p className="mt-1 break-all text-sm text-[var(--muted)]">{entry.sourceId}</p>
        </div>
        <div>
          <p className="text-sm text-[var(--muted)]">Idempotency key</p>
          <p className="mt-1 break-all font-mono text-sm">{entry.idempotencyKey}</p>
        </div>
        {entry.memo && <div className="md:col-span-2">
          <p className="text-sm text-[var(--muted)]">Memo</p>
          <p className="mt-1 whitespace-pre-wrap">{entry.memo}</p>
        </div>}
      </div>
    </section>

    {(entry.reversalOf || entry.reversedBy.length > 0) && <section className="rounded-2xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-5">
      <h2 className="text-lg font-semibold">Reversal links</h2>
      {entry.reversalOf && <p className="mt-3 text-sm text-[var(--muted)]">This journal reverses <Link href={`/business/${businessId}/accounting/journals/${entry.reversalOf.id}`} className="font-medium text-[var(--brand)] hover:underline">{entry.reversalOf.id.slice(0, 8)}</Link> posted on {formatDate(entry.reversalOf.postingDate)}.</p>}
      {entry.reversedBy.length > 0 && <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">{entry.reversedBy.map((reversal) => <p key={reversal.id}>Reversed by <Link href={`/business/${businessId}/accounting/journals/${reversal.id}`} className="font-medium text-[var(--brand)] hover:underline">{reversal.id.slice(0, 8)}</Link> posted on {formatDate(reversal.postingDate)}.</p>)}</div>}
    </section>}

    <section>
      <div className="flex items-center justify-between gap-4">
        <div><h2 className="text-xl font-semibold">Lines</h2><p className="mt-1 text-sm text-[var(--muted)]">Debit and credit lines recorded exactly as posted.</p></div>
        <span className="text-sm text-[var(--muted)]">{entry.lines.length} lines</span>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-[var(--muted)]"><tr><th className="px-4 py-3">Line</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">{entry.lines.map((line) => <tr key={line.id}>
            <td className="px-4 py-4">{line.lineNumber}</td>
            <td className="px-4 py-4"><p className="font-medium">{line.account.code}</p><p className="text-xs text-[var(--muted)]">{line.account.name}</p></td>
            <td className="px-4 py-4 text-[var(--muted)]">{line.description || "-"}</td>
            <td className="px-4 py-4 text-right font-medium tabular-nums">{entry.currencyCode} {Number(line.debit).toFixed(4)}</td>
            <td className="px-4 py-4 text-right font-medium tabular-nums">{entry.currencyCode} {Number(line.credit).toFixed(4)}</td>
          </tr>)}</tbody>
          <tfoot className="border-t border-[var(--border)] bg-[var(--surface-muted)] font-semibold"><tr><td className="px-4 py-3" colSpan={3}>Totals</td><td className="px-4 py-3 text-right tabular-nums">{entry.currencyCode} {total}</td><td className="px-4 py-3 text-right tabular-nums">{entry.currencyCode} {total}</td></tr></tfoot>
        </table></div>
      </div>
    </section>
  </div>;
}
