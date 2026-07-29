"use client";

import { useState } from "react";

export function LedgerAccountStatusButton({
  businessId,
  accountId,
  status,
  required,
}: {
  businessId: string;
  accountId: string;
  status: "ACTIVE" | "INACTIVE";
  required: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const nextStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  async function changeStatus() {
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/businesses/${businessId}/accounting/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", data: { status: nextStatus } }),
    });
    const result = await response.json();
    setPending(false);
    if (!response.ok) {
      setMessage(result.message ?? "The account status could not be changed.");
      return;
    }
    window.location.reload();
  }

  return <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
    <button
      type="button"
      disabled={pending || (required && status === "ACTIVE")}
      onClick={changeStatus}
      className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Updating…" : status === "ACTIVE" ? "Deactivate account" : "Reactivate account"}
    </button>
    {required && status === "ACTIVE" && <span className="text-sm text-[var(--muted)]">Required system account</span>}
    {message && <span role="status" className="text-sm text-[var(--danger)]">{message}</span>}
  </div>;
}