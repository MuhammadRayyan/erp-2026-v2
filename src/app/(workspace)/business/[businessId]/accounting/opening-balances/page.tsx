import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OpeningBalanceForm } from "@/components/accounting/opening-balance-form";
import { hasBusinessCapability } from "@/modules/access/roles";
import { requireBusinessPageAccess } from "@/modules/access/server/business-page";
import { listLedgerAccounts } from "@/modules/accounting/server/accounts";
import { isOpeningBalanceInputAccountEligible } from "@/modules/accounting/server/opening-balances";

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function OpeningBalancesPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  let access;
  try {
    access = await requireBusinessPageAccess(businessId, "accounting.view", "accounting.core");
  } catch {
    notFound();
  }

  const canManage = hasBusinessCapability(access.context.roleKey, "accounting.manage");
  const accounts = await listLedgerAccounts(access.context);
  const eligibleAccounts = accounts
    .filter(isOpeningBalanceInputAccountEligible)
    .map((account) => ({
      id: account.id,
      code: account.code,
      name: account.name,
      class: account.class,
      type: account.type,
    }));

  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[var(--brand)]">Accounting kernel · opening balances</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Opening balances</h1>
        <p className="mt-2 max-w-3xl text-[var(--muted)]">Create the one controlled cutover posting for this business. Posted opening balances become immutable journal evidence.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/business/${businessId}/accounting/journals`} className="rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white">Posted journals</Link>
        <Link href={`/business/${businessId}/accounting`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-medium">Chart</Link>
        <Link href={`/business/${businessId}/accounting/periods`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-medium">Periods</Link>
      </div>
    </div>

    <div className="rounded-2xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-4 text-sm">
      <p className="font-medium">Subledger shortcuts remain blocked</p>
      <p className="mt-1 text-[var(--muted)]">Receivables, payables, inventory, VAT, retained earnings, and bank reconciliation still need dedicated cutover policies. This page only posts eligible balance-sheet accounts and lets the kernel balance the net amount to owner capital.</p>
    </div>

    {canManage ? eligibleAccounts.length > 0
      ? <OpeningBalanceForm businessId={businessId} accounts={eligibleAccounts} idempotencyKey={`opening-balances-${randomUUID()}`} />
      : <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-sm text-[var(--muted)]">No eligible active posting accounts are available for controlled opening balances.</div>
      : <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-sm text-[var(--muted)]">You can view opening-balance policy, but posting requires accounting management access.</div>}

    <section>
      <div className="flex items-center justify-between gap-4">
        <div><h2 className="text-xl font-semibold">Eligible account register</h2><p className="mt-1 text-sm text-[var(--muted)]">Only active non-control balance-sheet posting accounts are selectable for this first cutover workflow.</p></div>
        <span className="text-sm text-[var(--muted)]">{eligibleAccounts.length} eligible</span>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {eligibleAccounts.length === 0 ? <div className="p-10 text-center text-sm text-[var(--muted)]">No eligible accounts.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-[var(--muted)]"><tr><th className="px-4 py-3">Account</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Type</th></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">{eligibleAccounts.map((account) => <tr key={account.id}>
            <td className="px-4 py-4"><span className="font-medium">{account.code} · {account.name}</span></td>
            <td className="px-4 py-4">{label(account.class)}</td>
            <td className="px-4 py-4">{label(account.type)}</td>
          </tr>)}</tbody>
        </table></div>}
      </div>
    </section>
  </div>;
}
