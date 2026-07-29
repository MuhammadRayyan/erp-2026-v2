"use client";

import { useState } from "react";
import {
  accountClasses,
  accountKinds,
  accountNormalBalances,
  accountTypes,
} from "@/modules/accounting/contracts/accounts";

type AccountValue = {
  code: string;
  name: string;
  description: string | null;
  class: string;
  type: string;
  normalBalance: string;
  kind: string;
  isContra: boolean;
  manualPostingAllowed: boolean;
  parentId: string | null;
  systemManaged: boolean;
};

type HeaderOption = {
  id: string;
  code: string;
  name: string;
  class: string;
  status: string;
};

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function LedgerAccountForm({
  businessId,
  accountId,
  initial,
  headers,
}: {
  businessId: string;
  accountId?: string;
  initial?: AccountValue;
  headers: HeaderOption[];
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const editing = Boolean(accountId && initial);
  const structuralLocked = Boolean(initial?.systemManaged);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage(null);

    const payload = {
      code: data.get("code"),
      name: data.get("name"),
      description: data.get("description"),
      class: data.get("class"),
      type: data.get("type"),
      normalBalance: data.get("normalBalance"),
      kind: data.get("kind"),
      isContra: data.get("isContra") === "on" || data.get("isContra") === "true",
      manualPostingAllowed: data.get("manualPostingAllowed") === "on" || data.get("manualPostingAllowed") === "true",
      parentId: data.get("parentId"),
    };

    const response = await fetch(
      editing
        ? `/api/businesses/${businessId}/accounting/accounts/${accountId}`
        : `/api/businesses/${businessId}/accounting/accounts`,
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      },
    );
    const result = await response.json();
    setPending(false);
    if (!response.ok) {
      const issue = Array.isArray(result.issues) ? result.issues[0]?.message : null;
      setMessage(issue ?? result.message ?? "The account could not be saved.");
      return;
    }
    if (!editing) form.reset();
    window.location.reload();
  }

  const inputClass = "rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 outline-none focus:border-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60";

  return <form onSubmit={submit} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
    <div>
      <p className="text-sm font-medium text-[var(--brand)]">{editing ? "Account settings" : "Custom account"}</p>
      <h2 className="mt-1 text-xl font-semibold">{editing ? "Edit ledger account" : "Add ledger account"}</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">{structuralLocked ? "System account classification and hierarchy are locked; code, name, and description remain editable." : "Choose a class, type, normal balance, hierarchy position, and posting behavior."}</p>
    </div>

    <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <label className="grid gap-2 text-sm font-medium">Code<input name="code" required maxLength={20} defaultValue={initial?.code ?? ""} className={inputClass} placeholder="7010" /></label>
      <label className="grid gap-2 text-sm font-medium md:col-span-2">Name<input name="name" required maxLength={160} defaultValue={initial?.name ?? ""} className={inputClass} placeholder="Marketing expense" /></label>
      <label className="grid gap-2 text-sm font-medium">Class<select name="class" defaultValue={initial?.class ?? "EXPENSE"} disabled={structuralLocked} className={inputClass}>{accountClasses.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select>{structuralLocked && <input type="hidden" name="class" value={initial!.class} />}</label>
      <label className="grid gap-2 text-sm font-medium">Type<select name="type" defaultValue={initial?.type ?? "OPERATING_EXPENSE"} disabled={structuralLocked} className={inputClass}>{accountTypes.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select>{structuralLocked && <input type="hidden" name="type" value={initial!.type} />}</label>
      <label className="grid gap-2 text-sm font-medium">Kind<select name="kind" defaultValue={initial?.kind ?? "POSTING"} disabled={structuralLocked} className={inputClass}>{accountKinds.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select>{structuralLocked && <input type="hidden" name="kind" value={initial!.kind} />}</label>
      <label className="grid gap-2 text-sm font-medium">Normal balance<select name="normalBalance" defaultValue={initial?.normalBalance ?? "DEBIT"} disabled={structuralLocked} className={inputClass}>{accountNormalBalances.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select>{structuralLocked && <input type="hidden" name="normalBalance" value={initial!.normalBalance} />}</label>
      <label className="grid gap-2 text-sm font-medium lg:col-span-2">Parent header<select name="parentId" defaultValue={initial?.parentId ?? ""} disabled={structuralLocked} className={inputClass}><option value="">Top level</option>{headers.map((header) => <option key={header.id} value={header.id}>{header.code} · {header.name} · {label(header.class)}{header.status === "INACTIVE" ? " (inactive)" : ""}</option>)}</select>{structuralLocked && <input type="hidden" name="parentId" value={initial!.parentId ?? ""} />}</label>
      <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm font-medium"><input name="isContra" type="checkbox" defaultChecked={initial?.isContra ?? false} disabled={structuralLocked} />Contra account{structuralLocked && <input type="hidden" name="isContra" value={initial!.isContra ? "true" : "false"} />}</label>
      <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm font-medium"><input name="manualPostingAllowed" type="checkbox" defaultChecked={initial?.manualPostingAllowed ?? true} disabled={structuralLocked} />Manual posting allowed{structuralLocked && <input type="hidden" name="manualPostingAllowed" value={initial!.manualPostingAllowed ? "true" : "false"} />}</label>
      <label className="grid gap-2 text-sm font-medium md:col-span-2 lg:col-span-3">Description<textarea name="description" rows={3} maxLength={1000} defaultValue={initial?.description ?? ""} className={inputClass} placeholder="Purpose and usage notes" /></label>
    </div>

    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button disabled={pending} className="rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Saving…" : editing ? "Save account" : "Create account"}</button>
      {message && <p role="status" className="text-sm text-[var(--danger)]">{message}</p>}
    </div>
  </form>;
}