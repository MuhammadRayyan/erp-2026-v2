"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FileUploadForm({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/businesses/${businessId}/files`, { method: "POST", body: formData });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Upload failed.");
      setMessage("File uploaded securely.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return <form action={submit} className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 md:grid-cols-2">
    <div className="md:col-span-2">
      <h2 className="text-lg font-semibold">Upload private file</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">Accepted: PDF, PNG, JPEG, WebP, CSV, DOCX, XLSX. Maximum size follows the server setting.</p>
    </div>
    <label className="grid gap-1 text-sm font-medium">File<input required name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.docx,.xlsx" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2" /></label>
    <label className="grid gap-1 text-sm font-medium">Label<input name="label" maxLength={160} placeholder="Trade license, customer agreement…" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5" /></label>
    <input type="hidden" name="entityType" value="BUSINESS" />
    <input type="hidden" name="entityId" value={businessId} />
    <div className="md:col-span-2 flex items-center gap-3">
      <button disabled={busy} className="rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white disabled:opacity-60">{busy ? "Uploading…" : "Upload privately"}</button>
      {message && <p className="text-sm text-[var(--muted)]">{message}</p>}
    </div>
  </form>;
}
