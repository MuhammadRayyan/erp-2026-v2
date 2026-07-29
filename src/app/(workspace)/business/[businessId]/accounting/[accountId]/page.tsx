import Link from "next/link";
import { notFound } from "next/navigation";
import { LedgerAccountForm } from "@/components/accounting/ledger-account-form";
import { LedgerAccountStatusButton } from "@/components/accounting/ledger-account-status-button";
import { Card } from "@/components/ui/card";
import { hasBusinessCapability } from "@/modules/access/roles";
import { requireBusinessPageAccess } from "@/modules/access/server/business-page";
import { getLedgerAccount, listLedgerAccounts } from "@/modules/accounting/server/accounts";

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function LedgerAccountPage({ params }: { params: Promise<{ businessId: string; accountId: string }> }) {
  const { businessId, accountId } = await params;
  let access;
  try {
    access = await requireBusinessPageAccess(businessId, "accounting.view", "accounting.core");
  } catch {
    notFound();
  }

  let account;
  try {
    account = await getLedgerAccount(access.context, accountId);
  } catch {
    notFound();
  }
  const accounts = await listLedgerAccounts(access.context);
  const headers = accounts
    .filter((candidate) => candidate.kind === "HEADER" && candidate.id !== account.id)
    .map((candidate) => ({ id: candidate.id, code: candidate.code, name: candidate.name, class: candidate.class, status: candidate.status }));
  const canManage = hasBusinessCapability(access.context.roleKey, "accounting.manage");

  return <div className="space-y-8">
    <div>
      <Link href={`/business/${businessId}/accounting`} className="text-sm font-medium text-[var(--brand)] hover:underline">← Chart of accounts</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-medium text-[var(--brand)]">{label(account.class)} · {label(account.type)}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{account.code} · {account.name}</h1><p className="mt-2 max-w-3xl text-[var(--muted)]">{account.description || "No account description."}</p></div>
        <div className="flex flex-wrap gap-2"><span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-sm">{label(account.kind)}</span><span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-sm">{label(account.status)}</span>{account.systemManaged && <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-sm text-[var(--brand)]">System managed</span>}</div>
      </div>
    </div>

    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card><p className="text-sm text-[var(--muted)]">Normal balance</p><p className="mt-2 text-lg font-semibold">{label(account.normalBalance)}{account.isContra ? " contra" : ""}</p></Card>
      <Card><p className="text-sm text-[var(--muted)]">Manual posting</p><p className="mt-2 text-lg font-semibold">{account.manualPostingAllowed ? "Allowed" : "Blocked"}</p></Card>
      <Card><p className="text-sm text-[var(--muted)]">Parent</p><p className="mt-2 text-lg font-semibold">{account.parent ? `${account.parent.code} · ${account.parent.name}` : "Top level"}</p></Card>
      <Card><p className="text-sm text-[var(--muted)]">Children</p><p className="mt-2 text-lg font-semibold">{account.children.length}</p></Card>
    </section>

    {account.children.length > 0 && <section><h2 className="text-xl font-semibold">Child accounts</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{account.children.map((child) => <Card key={child.id}><Link href={`/business/${businessId}/accounting/${child.id}`} className="font-medium text-[var(--brand)] hover:underline">{child.code} · {child.name}</Link><p className="mt-1 text-sm text-[var(--muted)]">{label(child.status)}</p></Card>)}</div></section>}

    {canManage && <>
      <LedgerAccountForm
        businessId={businessId}
        accountId={account.id}
        headers={headers}
        initial={{
          code: account.code,
          name: account.name,
          description: account.description,
          class: account.class,
          type: account.type,
          normalBalance: account.normalBalance,
          kind: account.kind,
          isContra: account.isContra,
          manualPostingAllowed: account.manualPostingAllowed,
          parentId: account.parentId,
          systemManaged: account.systemManaged,
        }}
      />
      <Card><h2 className="text-xl font-semibold">Lifecycle</h2><p className="mt-2 text-sm text-[var(--muted)]">Deactivation preserves the account and its audit history. Required system accounts and headers with active children cannot be deactivated.</p><LedgerAccountStatusButton businessId={businessId} accountId={account.id} status={account.status} required={account.required} /></Card>
    </>}
  </div>;
}