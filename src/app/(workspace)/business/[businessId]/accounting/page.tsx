import Link from "next/link";
import { notFound } from "next/navigation";
import type { AccountClass, AccountStatus } from "@/generated/prisma/client";
import { LedgerAccountForm } from "@/components/accounting/ledger-account-form";
import { hasBusinessCapability } from "@/modules/access/roles";
import { requireBusinessPageAccess } from "@/modules/access/server/business-page";
import { accountClasses, accountStatuses } from "@/modules/accounting/contracts/accounts";
import { listLedgerAccounts } from "@/modules/accounting/server/accounts";

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function AccountingPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ q?: string; class?: string; status?: string }>;
}) {
  const { businessId } = await params;
  const filters = await searchParams;
  let access;
  try {
    access = await requireBusinessPageAccess(businessId, "accounting.view", "accounting.core");
  } catch {
    notFound();
  }

  const accountClass = accountClasses.includes(filters.class as AccountClass) ? filters.class as AccountClass : undefined;
  const status = accountStatuses.includes(filters.status as AccountStatus) ? filters.status as AccountStatus : undefined;
  const hasFilters = Boolean(filters.q?.trim() || accountClass || status);
  const [accounts, allAccounts] = await Promise.all([
    listLedgerAccounts(access.context, { query: filters.q, class: accountClass, status }),
    hasFilters ? listLedgerAccounts(access.context) : Promise.resolve(null),
  ]);
  const canManage = hasBusinessCapability(access.context.roleKey, "accounting.manage");
  const headers = (allAccounts ?? accounts)
    .filter((account) => account.kind === "HEADER")
    .map((account) => ({ id: account.id, code: account.code, name: account.name, class: account.class, status: account.status }));

  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[var(--brand)]">Accounting kernel · structure</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Chart of accounts</h1>
        <p className="mt-2 max-w-3xl text-[var(--muted)]">Business-scoped account classes, hierarchy, control accounts, normal balances, and lifecycle. This foundation does not create balances or journal postings.</p>
      </div>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={filters.q} placeholder="Search code or name" className="min-w-64 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5" />
        <select name="class" defaultValue={filters.class ?? ""} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"><option value="">All classes</option>{accountClasses.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select>
        <select name="status" defaultValue={filters.status ?? ""} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"><option value="">All statuses</option>{accountStatuses.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select>
        <button className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-medium">Filter</button>
      </form>
    </div>

    <div className="rounded-2xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-4 text-sm">
      <p className="font-medium">Structure only</p>
      <p className="mt-1 text-[var(--muted)]">Journal entry, opening balance, period lock, receivable/payable allocation, and financial report workflows remain blocked until later Phase 4 slices verify the balanced posting kernel.</p>
    </div>

    {canManage && <LedgerAccountForm businessId={businessId} headers={headers} />}

    <section>
      <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-semibold">Account register</h2><p className="mt-1 text-sm text-[var(--muted)]">Default UAE-oriented small-business structure plus custom accounts.</p></div><span className="text-sm text-[var(--muted)]">{accounts.length} accounts</span></div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {accounts.length === 0 ? <div className="p-10 text-center text-sm text-[var(--muted)]">No matching accounts.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-[var(--muted)]"><tr><th className="px-4 py-3">Account</th><th className="px-4 py-3">Class / type</th><th className="px-4 py-3">Kind</th><th className="px-4 py-3">Normal balance</th><th className="px-4 py-3">Parent</th><th className="px-4 py-3">Status</th></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">{accounts.map((account) => <tr key={account.id}>
            <td className="px-4 py-4"><Link href={`/business/${businessId}/accounting/${account.id}`} className="font-medium text-[var(--brand)] hover:underline">{account.code} · {account.name}</Link><p className="mt-1 text-xs text-[var(--muted)]">{account.systemManaged ? `System · ${account.systemKey}` : "Custom account"}{account.required ? " · required" : ""}</p></td>
            <td className="px-4 py-4"><p>{label(account.class)}</p><p className="text-xs text-[var(--muted)]">{label(account.type)}</p></td>
            <td className="px-4 py-4"><p>{label(account.kind)}</p><p className="text-xs text-[var(--muted)]">{account.manualPostingAllowed ? "Manual posting allowed" : "Manual posting blocked"}</p></td>
            <td className="px-4 py-4">{label(account.normalBalance)}{account.isContra ? " · contra" : ""}</td>
            <td className="px-4 py-4">{account.parent ? `${account.parent.code} · ${account.parent.name}` : "Top level"}{account._count.children > 0 && <p className="text-xs text-[var(--muted)]">{account._count.children} children</p>}</td>
            <td className="px-4 py-4"><span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs">{label(account.status)}</span></td>
          </tr>)}</tbody>
        </table></div>}
      </div>
    </section>
  </div>;
}