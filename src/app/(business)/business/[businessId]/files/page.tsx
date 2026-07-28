import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { FileUploadForm } from "@/components/files/file-upload-form";
import { requireBusinessPageAccess } from "@/modules/access/server/business-page";
import { hasBusinessCapability } from "@/modules/access/roles";
import { listStoredFiles } from "@/modules/files/server/files";
import { listAuditEvents } from "@/modules/audit/server/audit";

function size(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function FilesPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  let access;
  try {
    access = await requireBusinessPageAccess(businessId, "files.view", "files.core");
  } catch {
    notFound();
  }
  const [files, events] = await Promise.all([
    listStoredFiles(access.context),
    hasBusinessCapability(access.context.roleKey, "audit.view") ? listAuditEvents(access.context, 50) : Promise.resolve([]),
  ]);
  const canManage = hasBusinessCapability(access.context.roleKey, "files.manage");

  return <div className="space-y-8">
    <div>
      <p className="text-sm font-medium text-[var(--brand)]">Shared operations</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Files & History</h1>
      <p className="mt-2 max-w-3xl text-[var(--muted)]">Private business files, attachment scope, content hashes, and append-only activity history. Files are never served from the public web root.</p>
    </div>

    {canManage && <FileUploadForm businessId={businessId} />}

    <section>
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Private files</h2><span className="text-sm text-[var(--muted)]">{files.length} records</span></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">{files.length === 0 ? <Card><p className="text-sm text-[var(--muted)]">No private files have been uploaded.</p></Card> : files.map((file) => <Card key={file.id}>
        <div className="flex items-start justify-between gap-4">
          <div><h3 className="font-semibold">{file.safeName}</h3><p className="mt-1 text-sm text-[var(--muted)]">{file.contentType} · {size(file.sizeBytes)}</p></div>
          <Link href={`/api/businesses/${businessId}/files/${file.id}`} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-medium">Download</Link>
        </div>
        <dl className="mt-4 grid gap-2 text-sm">
          <div><dt className="text-[var(--muted)]">SHA-256</dt><dd className="break-all font-mono text-xs">{file.sha256}</dd></div>
          <div><dt className="text-[var(--muted)]">Attached to</dt><dd>{file.attachments.map((item) => `${item.entityType}:${item.entityId}${item.label ? ` (${item.label})` : ""}`).join(", ")}</dd></div>
          <div><dt className="text-[var(--muted)]">Uploaded</dt><dd>{file.createdAt.toLocaleString("en-US")}</dd></div>
        </dl>
      </Card>)}</div>
    </section>

    {events.length > 0 && <section>
      <h2 className="text-xl font-semibold">Recent audit history</h2>
      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="divide-y divide-[var(--border)]">{events.map((event) => <div key={event.id} className="grid gap-1 p-4 md:grid-cols-[180px_1fr_220px]">
          <p className="text-xs font-medium text-[var(--brand)]">{event.eventType}</p>
          <div><p className="text-sm font-medium">{event.summary}</p><p className="text-xs text-[var(--muted)]">{event.entityType}:{event.entityId}</p></div>
          <p className="text-xs text-[var(--muted)] md:text-right">{event.occurredAt.toLocaleString("en-US")}</p>
        </div>)}</div>
      </div>
    </section>}
  </div>;
}
