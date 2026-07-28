"use client";

import { useState } from "react";

const template = `type,sku,name,description,unit_code,sales_enabled,purchase_enabled,sales_price,purchase_price,sales_account_class,purchase_account_class,sales_tax_category,purchase_tax_category
PRODUCT,BRAKE-001,Brake Pad Set,Front axle set,EA,true,true,145.1250,82.5000,SALES_REVENUE,INVENTORY_PURCHASES,STANDARD_RATE,STANDARD_RATE
SERVICE,LABOUR-01,Workshop Labour,Hourly labour,HOUR,true,false,180.0000,,SERVICE_REVENUE,DIRECT_EXPENSE,STANDARD_RATE,UNSPECIFIED`;

type ImportRow = {
  id: string;
  rowNumber: number;
  action: "CREATE" | "UPDATE" | "SKIP" | "CONFLICT" | "INVALID";
  existingItemId: string | null;
  rawData: Record<string, string>;
  issues: string[];
};

type ImportBatch = { id: string; status: string; sourceName: string; totalRows: number; rows: ImportRow[] };

export function CatalogImportWorkbench({ businessId }: { businessId: string }) {
  const [csv, setCsv] = useState(template);
  const [sourceName, setSourceName] = useState("catalog-import.csv");
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const base = `/api/businesses/${businessId}/catalog/imports`;

  async function preview() {
    setMessage(null);
    const response = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceName, csv }) });
    const result = await response.json();
    if (!response.ok) return setMessage(result.message ?? "Preview failed.");
    setBatch(result.batch);
  }

  async function refresh(batchId: string) {
    const response = await fetch(`${base}/${batchId}`);
    const result = await response.json();
    if (response.ok) setBatch(result.batch);
  }

  async function resolve(rowId: string, resolution: "CREATE" | "UPDATE" | "SKIP") {
    if (!batch) return;
    const response = await fetch(`${base}/${batch.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resolve", rowId, resolution }) });
    const result = await response.json();
    if (!response.ok) return setMessage(result.message ?? "Resolution failed.");
    await refresh(batch.id);
  }

  async function commit() {
    if (!batch) return;
    setMessage(null);
    const response = await fetch(`${base}/${batch.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "commit" }) });
    const result = await response.json();
    if (!response.ok) return setMessage(result.message ?? "Commit failed.");
    setMessage(`Committed: ${result.result.imported} created, ${result.result.updated} updated, ${result.result.skipped} skipped.`);
    await refresh(batch.id);
  }

  const unresolved = batch?.rows.some((row) => row.action === "CONFLICT" || row.action === "INVALID") ?? true;

  return <div className="space-y-6">
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <p className="text-sm font-medium text-[var(--brand)]">Staged import</p>
      <h2 className="mt-1 text-xl font-semibold">Preview catalog CSV</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">Rows are stored for review first. Existing SKUs and exact-name matches require an explicit update, create, or skip decision.</p>
      <label className="mt-4 block text-sm font-medium">Source name<input value={sourceName} onChange={(event) => setSourceName(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5" /></label>
      <label className="mt-4 block text-sm font-medium">CSV content<textarea value={csv} onChange={(event) => setCsv(event.target.value)} rows={10} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 font-mono text-xs" /></label>
      <button onClick={preview} className="mt-4 rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white">Create preview</button>
    </section>

    {batch && <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Import review</h2><p className="text-sm text-[var(--muted)]">{batch.sourceName} · {batch.totalRows} rows · {batch.status.toLowerCase()}</p></div>{batch.status === "PREVIEW" && <button onClick={commit} disabled={unresolved} className="rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">Commit resolved rows</button>}</div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-[var(--surface-muted)] text-[var(--muted)]"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">SKU / Name</th><th className="px-3 py-2">Decision</th><th className="px-3 py-2">Issues</th><th className="px-3 py-2">Resolve</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{batch.rows.map((row) => <tr key={row.id}><td className="px-3 py-3">{row.rowNumber}</td><td className="px-3 py-3"><p className="font-medium">{row.rawData.sku || "No SKU"}</p><p className="text-xs text-[var(--muted)]">{row.rawData.name}</p></td><td className="px-3 py-3"><span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs">{row.action.toLowerCase()}</span></td><td className="px-3 py-3 text-xs text-[var(--muted)]">{row.issues.length ? row.issues.join(" ") : "Ready"}</td><td className="px-3 py-3">{batch.status === "PREVIEW" && row.action !== "INVALID" && <div className="flex gap-2"><button onClick={() => resolve(row.id, "CREATE")} className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs">Create</button>{row.existingItemId && <button onClick={() => resolve(row.id, "UPDATE")} className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs">Update</button>}<button onClick={() => resolve(row.id, "SKIP")} className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs">Skip</button></div>}</td></tr>)}</tbody></table></div>
    </section>}
    {message && <p className="text-sm text-[var(--muted)]">{message}</p>}
  </div>;
}
