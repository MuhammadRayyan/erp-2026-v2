"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Allocation = { id: string; formattedValue: string; effectiveDate: string | Date; status: "ALLOCATED" | "VOIDED"; createdAt: string | Date };
type Sequence = {
  id: string;
  key: string;
  label: string;
  prefixTemplate: string;
  suffixTemplate: string;
  padding: number;
  startValue: number;
  nextValue: number;
  resetPolicy: "NEVER" | "YEARLY" | "MONTHLY";
  currentPeriodKey: string | null;
  active: boolean;
  allocations: Allocation[];
};

export function NumberSequenceForm({ businessId, sequence, editable }: { businessId: string; sequence: Sequence; editable: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(formData: FormData) {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/businesses/${businessId}/numbering`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update-sequence",
        sequenceId: sequence.id,
        data: {
          label: formData.get("label"),
          prefixTemplate: formData.get("prefixTemplate"),
          suffixTemplate: formData.get("suffixTemplate"),
          padding: formData.get("padding"),
          startValue: formData.get("startValue"),
          resetPolicy: formData.get("resetPolicy"),
          active: formData.get("active") === "on",
        },
      }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(result.message || "The sequence could not be saved.");
      return;
    }
    setMessage("Sequence updated. Existing allocations were not changed.");
    router.refresh();
  }

  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{sequence.key}</p><h2 className="mt-1 text-lg font-semibold">{sequence.label}</h2></div>
      <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs">{sequence.active ? "Active" : "Inactive"}</span>
    </div>
    <form action={save} className="mt-5 grid gap-4 md:grid-cols-2">
      <label className="text-sm">Label<input name="label" defaultValue={sequence.label} disabled={!editable} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 disabled:opacity-60" /></label>
      <label className="text-sm">Reset policy<select name="resetPolicy" defaultValue={sequence.resetPolicy} disabled={!editable} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 disabled:opacity-60"><option value="YEARLY">Yearly</option><option value="MONTHLY">Monthly</option><option value="NEVER">Never</option></select></label>
      <label className="text-sm">Prefix template<input name="prefixTemplate" defaultValue={sequence.prefixTemplate} disabled={!editable} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-mono disabled:opacity-60" /></label>
      <label className="text-sm">Suffix template<input name="suffixTemplate" defaultValue={sequence.suffixTemplate} disabled={!editable} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-mono disabled:opacity-60" /></label>
      <label className="text-sm">Number padding<input name="padding" type="number" min="1" max="12" defaultValue={sequence.padding} disabled={!editable} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 disabled:opacity-60" /></label>
      <label className="text-sm">Starting value<input name="startValue" type="number" min="1" defaultValue={sequence.startValue} disabled={!editable} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 disabled:opacity-60" /></label>
      <label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked={sequence.active} disabled={!editable} /> Active for future allocations</label>
      <div className="text-sm text-[var(--muted)]">Next value: <span className="font-mono text-[var(--foreground)]">{sequence.nextValue}</span>{sequence.currentPeriodKey ? ` in ${sequence.currentPeriodKey}` : " when first used"}</div>
      {editable && <div className="md:col-span-2"><button disabled={saving} className="rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white disabled:opacity-60">{saving ? "Saving…" : "Save sequence"}</button></div>}
    </form>
    <p className="mt-3 text-xs text-[var(--muted)]">Supported tokens: {"{YYYY}"}, {"{YY}"}, and {"{MM}"}. Changes apply only to future allocations.</p>
    {message && <p className="mt-3 text-sm">{message}</p>}
    <div className="mt-5 border-t border-[var(--border)] pt-4">
      <h3 className="text-sm font-semibold">Recent allocations</h3>
      {sequence.allocations.length === 0 ? <p className="mt-2 text-sm text-[var(--muted)]">No numbers allocated yet.</p> : <div className="mt-2 space-y-2">{sequence.allocations.map((allocation) => <div key={allocation.id} className="flex items-center justify-between gap-3 text-sm"><span className="font-mono">{allocation.formattedValue}</span><span className="text-xs text-[var(--muted)]">{allocation.status.toLowerCase()} · {new Date(allocation.effectiveDate).toISOString().slice(0, 10)}</span></div>)}</div>}
    </div>
  </div>;
}
