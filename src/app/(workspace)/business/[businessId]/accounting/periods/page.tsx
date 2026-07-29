import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountingPeriodForm } from "@/components/accounting/accounting-period-form";
import { AccountingPeriodTransition } from "@/components/accounting/accounting-period-transition";
import { hasBusinessCapability } from "@/modules/access/roles";
import { requireBusinessPageAccess } from "@/modules/access/server/business-page";
import { formatAccountingDate } from "@/modules/accounting/contracts/periods";
import { listAccountingPeriods } from "@/modules/accounting/server/periods";

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function AccountingPeriodsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  let access;
  try {
    access = await requireBusinessPageAccess(businessId, "accounting.view", "accounting.core");
  } catch {
    notFound();
  }

  const periods = await listAccountingPeriods(access.context);
  const canManage = hasBusinessCapability(access.context.roleKey, "accounting.manage");

  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[var(--brand)]">Accounting kernel · period control</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Accounting periods</h1>
        <p className="mt-2 max-w-3xl text-[var(--muted)]">Define non-overlapping fiscal periods and control whether future posting dates are open, soft-locked, or closed.</p>
      </div>
      <Link href={`/business/${businessId}/accounting`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-medium">Back to chart</Link>
    </div>

    <div className="rounded-2xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-4 text-sm">
      <p className="font-medium">Posting remains blocked</p>
      <p className="mt-1 text-[var(--muted)]">These periods establish the date-lock boundary for the future journal kernel. No balances, journals, opening entries, or document posting are available yet.</p>
    </div>

    {canManage && <AccountingPeriodForm businessId={businessId} />}

    <section>
      <div className="flex items-center justify-between gap-4">
        <div><h2 className="text-xl font-semibold">Period register</h2><p className="mt-1 text-sm text-[var(--muted)]">Dates must stay inside one configured fiscal year and may never overlap.</p></div>
        <span className="text-sm text-[var(--muted)]">{periods.length} periods</span>
      </div>

      <div className="mt-4 space-y-4">
        {periods.length === 0 ? <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-sm text-[var(--muted)]">No accounting periods have been created.</div> : periods.map((period) => <article key={period.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">{period.name}</h3>
                <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium">{label(period.status)}</span>
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">{formatAccountingDate(period.startDate)} to {formatAccountingDate(period.endDate)}</p>
              {period.statusReason && <p className="mt-2 text-sm"><span className="font-medium">Latest reason:</span> {period.statusReason}</p>}
              {period.statusChangedAt && <p className="mt-1 text-xs text-[var(--muted)]">Status changed {period.statusChangedAt.toISOString()}</p>}
            </div>
          </div>

          {canManage && <div className="mt-5 space-y-4">
            {period.status === "OPEN" && <details className="rounded-xl border border-[var(--border)] p-4">
              <summary className="cursor-pointer font-medium">Edit open period</summary>
              <div className="mt-4"><AccountingPeriodForm businessId={businessId} periodId={period.id} initial={period} /></div>
            </details>}
            <AccountingPeriodTransition businessId={businessId} periodId={period.id} status={period.status} />
          </div>}
        </article>)}
      </div>
    </section>
  </div>;
}
