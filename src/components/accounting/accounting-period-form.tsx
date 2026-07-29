"use client";

import { useState } from "react";
import { formatAccountingDate } from "@/modules/accounting/contracts/periods";

type PeriodValue = {
  name: string;
  startDate: Date;
  endDate: Date;
};

export function AccountingPeriodForm({
  businessId,
  periodId,
  initial,
}: {
  businessId: string;
  periodId?: string;
  initial?: PeriodValue;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const editing = Boolean(periodId && initial);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage(null);

    const response = await fetch(
      editing
        ? `/api/businesses/${businessId}/accounting/periods/${periodId}`
        : `/api/businesses/${businessId}/accounting/periods`,
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            name: data.get("name"),
            startDate: data.get("startDate"),
            endDate: data.get("endDate"),
          },
        }),
      },
    );
    const result = await response.json();
    setPending(false);
    if (!response.ok) {
      const issue = Array.isArray(result.issues) ? result.issues[0]?.message : null;
      setMessage(issue ?? result.message ?? "The period could not be saved.");
      return;
    }
    if (!editing) form.reset();
    window.location.reload();
  }

  const inputClass = "rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 outline-none focus:border-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60";

  return <form onSubmit={submit} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
    <div>
      <p className="text-sm font-medium text-[var(--brand)]">{editing ? "Period settings" : "New accounting period"}</p>
      <h2 className="mt-1 text-xl font-semibold">{editing ? "Edit open period" : "Add accounting period"}</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">Periods cannot overlap or cross the configured fiscal-year boundary. Dates become immutable after the period is locked or closed.</p>
    </div>
    <div className="mt-5 grid gap-4 md:grid-cols-3">
      <label className="grid gap-2 text-sm font-medium">Name<input name="name" required maxLength={100} defaultValue={initial?.name ?? ""} className={inputClass} placeholder="January 2027" /></label>
      <label className="grid gap-2 text-sm font-medium">Start date<input name="startDate" type="date" required defaultValue={initial ? formatAccountingDate(initial.startDate) : ""} className={inputClass} /></label>
      <label className="grid gap-2 text-sm font-medium">End date<input name="endDate" type="date" required defaultValue={initial ? formatAccountingDate(initial.endDate) : ""} className={inputClass} /></label>
    </div>
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button disabled={pending} className="rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Saving…" : editing ? "Save period" : "Create period"}</button>
      {message && <p role="status" className="text-sm text-[var(--danger)]">{message}</p>}
    </div>
  </form>;
}
