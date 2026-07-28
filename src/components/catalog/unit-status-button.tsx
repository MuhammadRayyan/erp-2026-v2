"use client";

import { useState } from "react";

export function UnitStatusButton({ businessId, unitId, active }: { businessId: string; unitId: string; active: boolean }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/businesses/${businessId}/catalog`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unit-status", unitId, data: { active: !active } }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.message ?? "The unit status could not be changed.");
      setPending(false);
      return;
    }
    window.location.reload();
  }

  return <div className="mt-4">
    <button type="button" disabled={pending} onClick={toggle} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium disabled:opacity-60">{pending ? "Saving…" : active ? "Deactivate unit" : "Reactivate unit"}</button>
    {message && <p className="mt-2 text-xs text-[var(--muted)]">{message}</p>}
  </div>;
}
