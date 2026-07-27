import Link from "next/link";
import { modulesByGroup, type ModuleGroup } from "@/modules/core/module-registry";

const groups: readonly { key: ModuleGroup; label: string }[] = [
  { key: "work", label: "Work" },
  { key: "finance", label: "Finance" },
  { key: "operations", label: "Operations" },
  { key: "insights", label: "Insights" },
  { key: "settings", label: "Settings" },
];

export function BusinessShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-r border-[var(--border)] bg-[var(--surface)] p-4">
        <Link href="/businesses" className="block rounded-xl border border-[var(--border)] p-4">
          <span className="block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Active business</span>
          <strong className="mt-1 block">Demo Business</strong>
          <span className="text-sm text-[var(--muted)]">Switch business</span>
        </Link>
        <nav className="mt-6 space-y-6" aria-label="Business navigation">
          {groups.map((group) => (
            <div key={group.key}>
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{group.label}</p>
              <div className="space-y-1">
                {modulesByGroup(group.key).map((module) => (
                  <Link key={module.key} href={module.href} className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--surface-muted)]">
                    {module.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <div>
        <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">UAE · AED · FY 2026</p>
            <strong>Demo Business</strong>
          </div>
          <Link href="/platform" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Platform</Link>
        </header>
        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
