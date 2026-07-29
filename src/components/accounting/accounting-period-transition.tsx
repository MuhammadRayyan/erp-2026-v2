"use client";

import { useState } from "react";
import type { AccountingPeriodStatus } from "@/generated/prisma/client";

const transitions: Record<AccountingPeriodStatus, readonly AccountingPeriodStatus[]> = {
  OPEN: ["SOFT_LOCKED", "CLOSED"],
  SOFT_LOCKED: ["OPEN", "CLOSED"],
  CLOSED: ["OPEN"],
};

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function AccountingPeriodTransition({
  businessId,
  periodId,
  status,
}: {
  businessId: string;
  periodId: string;
  status: AccountingPeriodStatus;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/businesses/${businessId}/accounting/periods/${periodId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "transition",
        data: { status: data.get("status"), reason: data.get("reason") },
      }),
    });
    const result = await response.json();
    setPending(false);
    if (!response.ok) {
      const issue = Array.isArray(result.issues) ? result.issues[0]?.message : null;
      setMessage(issue ?? result.message ?? "The period status could not be changed.");
      return;
    }
    window.location.reload();
  }

  return <form onSubmit={submit} className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
    <div className="grid gap-3 md:grid-cols-[minmax(10rem,0.4fr)_1fr_auto] md:items-end">
      <label className="grid gap-1.5 text-sm font-medium">New status<select name="status" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">{transitions[status].map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
      <label className="grid gap-1.5 text-sm font-medium">Reason<input name="reason" required minLength={3} maxLength={500} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5" placeholder={status === "CLOSED" ? "Reason for reopening" : "Reason for lock, close, or reopen"} /></label>
      <button disabled={pending} className="rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Saving…" : "Change status"}</button>
    </div>
    {message && <p role="status" className="text-sm text-[var(--danger)]">{message}</p>}
  </form>;
}
