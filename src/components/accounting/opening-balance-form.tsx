"use client";

import { useMemo, useState } from "react";

type AccountOption = {
  id: string;
  code: string;
  name: string;
  class: string;
  type: string;
};

type OpeningBalanceRow = {
  key: string;
  accountId: string;
  description: string;
  debit: string;
  credit: string;
};

function newRow(accountId: string): OpeningBalanceRow {
  return {
    key: `${Date.now()}-${Math.random()}`,
    accountId,
    description: "",
    debit: "0",
    credit: "0",
  };
}

function decimalValue(value: string) {
  const parsed = Number(value || "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function amount(value: number) {
  return value.toFixed(4);
}

export function OpeningBalanceForm({
  businessId,
  accounts,
  idempotencyKey,
}: {
  businessId: string;
  accounts: AccountOption[];
  idempotencyKey: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<OpeningBalanceRow[]>([newRow(accounts[0]?.id ?? "")]);

  const totals = useMemo(() => {
    const debit = rows.reduce((sum, row) => sum + decimalValue(row.debit), 0);
    const credit = rows.reduce((sum, row) => sum + decimalValue(row.credit), 0);
    return { debit, credit, balancing: debit - credit };
  }, [rows]);

  function updateRow(key: string, patch: Partial<OpeningBalanceRow>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  }

  function removeRow(key: string) {
    setRows((current) => current.length === 1 ? current : current.filter((row) => row.key !== key));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage(null);

    const response = await fetch(`/api/businesses/${businessId}/accounting/opening-balances`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          cutoverDate: data.get("cutoverDate"),
          idempotencyKey,
          memo: data.get("memo") || null,
          lines: rows.map((row) => ({
            accountId: row.accountId,
            description: row.description.trim() || null,
            debit: row.debit || "0",
            credit: row.credit || "0",
          })),
        },
      }),
    });
    const result = await response.json();
    setPending(false);
    if (!response.ok) {
      const issue = Array.isArray(result.issues) ? result.issues[0]?.message : null;
      setMessage(issue ?? result.message ?? "Opening balances could not be posted.");
      return;
    }
    const journalId = result.journal?.id;
    if (typeof journalId === "string") {
      window.location.assign(`/business/${businessId}/accounting/journals/${journalId}`);
      return;
    }
    window.location.assign(`/business/${businessId}/accounting/journals`);
  }

  const inputClass = "rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 outline-none focus:border-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60";
  const canSubmit = accounts.length > 0 && rows.every((row) => row.accountId);

  return <form onSubmit={submit} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[var(--brand)]">Controlled cutover</p>
        <h2 className="mt-1 text-xl font-semibold">Post opening balances</h2>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">Post one business opening set through the accounting kernel. The system adds any net balancing amount to owner capital and rejects unsupported subledger shortcuts.</p>
      </div>
      <div className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
        <p className="font-medium">Net balancing</p>
        <p className="mt-1 text-[var(--muted)]">{totals.balancing === 0 ? "None" : totals.balancing > 0 ? `Credit owner capital ${amount(totals.balancing)}` : `Debit owner capital ${amount(Math.abs(totals.balancing))}`}</p>
      </div>
    </div>

    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <label className="grid gap-2 text-sm font-medium">Cutover date<input name="cutoverDate" type="date" required className={inputClass} /></label>
      <label className="grid gap-2 text-sm font-medium">Memo<input name="memo" maxLength={500} className={inputClass} placeholder="Opening balances approved by owner" /></label>
    </div>

    <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)]">
      <div className="grid min-w-[980px] grid-cols-[2fr_1.6fr_1fr_1fr_auto] gap-3 bg-[var(--surface-muted)] px-4 py-3 text-sm font-medium text-[var(--muted)]">
        <span>Account</span><span>Description</span><span>Debit</span><span>Credit</span><span>Action</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[980px] divide-y divide-[var(--border)]">
          {rows.map((row) => <div key={row.key} className="grid grid-cols-[2fr_1.6fr_1fr_1fr_auto] gap-3 px-4 py-3">
            <select value={row.accountId} onChange={(event) => updateRow(row.key, { accountId: event.target.value })} required className={inputClass}>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name} ({account.class.toLowerCase()})</option>)}
            </select>
            <input value={row.description} onChange={(event) => updateRow(row.key, { description: event.target.value })} maxLength={300} className={inputClass} placeholder="Optional line note" />
            <input value={row.debit} onChange={(event) => updateRow(row.key, { debit: event.target.value, credit: event.target.value === "0" ? row.credit : "0" })} inputMode="decimal" pattern="^\d{1,16}(\.\d{1,4})?$" required className={`${inputClass} tabular-nums`} />
            <input value={row.credit} onChange={(event) => updateRow(row.key, { credit: event.target.value, debit: event.target.value === "0" ? row.debit : "0" })} inputMode="decimal" pattern="^\d{1,16}(\.\d{1,4})?$" required className={`${inputClass} tabular-nums`} />
            <button type="button" onClick={() => removeRow(row.key)} disabled={rows.length === 1} className="rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">Remove</button>
          </div>)}
        </div>
      </div>
    </div>

    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
      <p>Debit {amount(totals.debit)} · Credit {amount(totals.credit)}</p>
      <button type="button" onClick={() => setRows((current) => [...current, newRow(accounts[0]?.id ?? "")])} disabled={accounts.length === 0} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-medium disabled:cursor-not-allowed disabled:opacity-50">Add line</button>
    </div>

    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button disabled={pending || !canSubmit} className="rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Posting..." : "Post opening balances"}</button>
      {message && <p role="status" className="text-sm text-[var(--danger)]">{message}</p>}
    </div>
  </form>;
}
