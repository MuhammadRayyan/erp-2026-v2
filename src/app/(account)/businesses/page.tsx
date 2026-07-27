import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function BusinessesPage() {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--brand)]">Account Hub</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your businesses</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">Open a business workspace or create a new legal entity when your plan allows it.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white">
          <Plus size={18} /> New business
        </button>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link href="/business/dashboard">
          <Card className="transition hover:-translate-y-0.5 hover:border-[var(--brand)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-muted)]"><Building2 size={22} /></div>
            <h2 className="mt-5 text-xl font-semibold">Demo Business</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Technical Services · UAE</p>
            <div className="mt-5 flex justify-between text-sm"><span>AED base currency</span><span className="text-[var(--brand)]">Open →</span></div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
