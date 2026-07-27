import { ArrowUpRight, CircleAlert, FileText, WalletCards } from "lucide-react";
import { Card } from "@/components/ui/card";

const metrics = [
  { label: "Cash position", value: "AED 0.00", icon: WalletCards },
  { label: "Receivables", value: "AED 0.00", icon: ArrowUpRight },
  { label: "Open documents", value: "0", icon: FileText },
  { label: "Exceptions", value: "0", icon: CircleAlert },
];

export default function DashboardPage() {
  return (
    <div>
      <p className="text-sm font-medium text-[var(--brand)]">Business overview</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-[var(--muted)]">Financial position, work queues, and exceptions will appear here as modules are enabled.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <div className="flex items-center justify-between"><span className="text-sm text-[var(--muted)]">{label}</span><Icon size={19} /></div>
            <p className="mt-5 text-2xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <h2 className="text-lg font-semibold">Work queue</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Approvals, overdue documents, failed jobs, and operational tasks use one shared queue pattern.</p>
          <div className="mt-6 rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">No pending work.</div>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Foundation status</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li>✓ Authenticated account access</li>
            <li>✓ Explicit business onboarding</li>
            <li>✓ Tenant-safe business membership</li>
            <li>✓ Live business workspace context</li>
            <li>○ Role capability enforcement</li>
            <li>○ Accounting kernel</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
