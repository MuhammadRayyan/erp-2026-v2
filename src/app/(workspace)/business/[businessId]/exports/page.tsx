import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { requireBusinessPageAccess } from "@/modules/access/server/business-page";
import { listExportRuns } from "@/modules/exports/server/exports";

export default async function ExportsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  let access;
  try {
    access = await requireBusinessPageAccess(businessId, "exports.run", "exports.core");
  } catch {
    notFound();
  }
  const runs = await listExportRuns(access.context);

  return <div className="space-y-8">
    <div>
      <p className="text-sm font-medium text-[var(--brand)]">Controlled data access</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Exports</h1>
      <p className="mt-2 max-w-3xl text-[var(--muted)]">Generate filtered CSV files from supported registers. CSV content is returned directly and is not retained by the application; immutable run metadata and checksums remain for audit.</p>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <Card><h2 className="font-semibold">Customers and suppliers</h2><p className="mt-2 text-sm text-[var(--muted)]">Use the export control on the party register to preserve name, role, and status filters.</p></Card>
      <Card><h2 className="font-semibold">Items and services</h2><p className="mt-2 text-sm text-[var(--muted)]">Use the export control on the catalog register to preserve search, type, and lifecycle filters.</p></Card>
    </div>

    <section>
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Recent export runs</h2><span className="text-sm text-[var(--muted)]">{runs.length} runs</span></div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {runs.length === 0 ? <div className="p-10 text-center text-sm text-[var(--muted)]">No exports have been generated.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-[var(--muted)]"><tr><th className="px-4 py-3">Dataset</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Rows</th><th className="px-4 py-3">File</th><th className="px-4 py-3">Filters</th><th className="px-4 py-3">SHA-256</th></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">{runs.map((run) => <tr key={run.id}>
            <td className="px-4 py-4 font-medium">{run.datasetKey}</td>
            <td className="px-4 py-4">{run.createdAt.toLocaleString("en-US")}</td>
            <td className="px-4 py-4 font-mono">{run.rowCount}</td>
            <td className="px-4 py-4">{run.fileName}</td>
            <td className="px-4 py-4 font-mono text-xs">{JSON.stringify(run.filters)}</td>
            <td className="max-w-72 truncate px-4 py-4 font-mono text-xs" title={run.sha256}>{run.sha256}</td>
          </tr>)}</tbody>
        </table></div>}
      </div>
    </section>
  </div>;
}
