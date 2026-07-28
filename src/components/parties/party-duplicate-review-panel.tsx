"use client";

import Link from "next/link";
import { useState } from "react";

type Review = {
  id: string;
  status: "OPEN" | "CONFIRMED" | "DISMISSED";
  score: number;
  evidence: { nameSimilarity?: number; exactEmail?: boolean; exactPhone?: boolean; exactTrn?: boolean };
  firstParty: { id: string; displayName: string; email: string | null; phone: string | null; taxRegistrationNumber: string | null; status: string };
  secondParty: { id: string; displayName: string; email: string | null; phone: string | null; taxRegistrationNumber: string | null; status: string };
};

export function PartyDuplicateReviewPanel({ businessId, reviews, canManage }: { businessId: string; reviews: Review[]; canManage: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const endpoint = `/api/businesses/${businessId}/parties/duplicates`;

  async function request(method: string, body?: unknown) {
    setPending(true);
    setMessage(null);
    const response = await fetch(endpoint, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    setPending(false);
    if (!response.ok) {
      setMessage(result.message ?? "The duplicate review could not be updated.");
      return;
    }
    setMessage(method === "POST" ? `Scan complete. ${result.candidatesFound ?? 0} candidate pairs evaluated.` : "Review updated.");
    window.location.reload();
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div><h2 className="text-lg font-semibold">Duplicate review queue</h2><p className="mt-1 text-sm text-[var(--muted)]">Scanning never changes party records. Confirmed pairs remain pending until a separate merge workflow is implemented.</p></div>
      {canManage && <button disabled={pending} onClick={() => request("POST")} className="rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white disabled:opacity-60">{pending ? "Scanning…" : "Scan for duplicates"}</button>}
    </div>
    {message && <p className="text-sm text-[var(--muted)]">{message}</p>}
    {reviews.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted)]">No duplicate candidates have been recorded.</div> : reviews.map((review) => {
      const evidence = [
        review.evidence.exactTrn && "Exact TRN",
        review.evidence.exactEmail && "Exact email",
        review.evidence.exactPhone && "Exact phone",
        typeof review.evidence.nameSimilarity === "number" && `Name similarity ${Math.round(review.evidence.nameSimilarity * 100)}%`,
      ].filter(Boolean) as string[];
      return <article key={review.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium">{review.status.toLowerCase()}</span><span className="ml-2 text-sm text-[var(--muted)]">Confidence {Math.round(review.score * 100)}%</span></div><div className="flex flex-wrap gap-2">{evidence.map((item) => <span key={item} className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-xs text-[var(--brand)]">{item}</span>)}</div></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[review.firstParty, review.secondParty].map((party) => <Link key={party.id} href={`/business/${businessId}/parties/${party.id}`} className="rounded-xl border border-[var(--border)] p-4 transition hover:border-[var(--brand)]"><h3 className="font-semibold">{party.displayName}</h3><dl className="mt-3 space-y-1 text-sm"><div><span className="text-[var(--muted)]">Email:</span> {party.email || "—"}</div><div><span className="text-[var(--muted)]">Phone:</span> {party.phone || "—"}</div><div><span className="text-[var(--muted)]">TRN:</span> {party.taxRegistrationNumber || "—"}</div><div><span className="text-[var(--muted)]">Status:</span> {party.status.toLowerCase()}</div></dl></Link>)}
        </div>
        {canManage && review.status === "OPEN" && <div className="mt-4 flex gap-2"><button disabled={pending} onClick={() => request("PATCH", { reviewId: review.id, status: "CONFIRMED" })} className="rounded-xl border border-[var(--brand)] px-3 py-2 text-sm font-medium text-[var(--brand)]">Confirm duplicate</button><button disabled={pending} onClick={() => request("PATCH", { reviewId: review.id, status: "DISMISSED" })} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-medium">Not a duplicate</button></div>}
      </article>;
    })}
  </div>;
}
