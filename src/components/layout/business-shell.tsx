import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { hasBusinessCapability } from "@/modules/access/roles";
import { modulesByGroup, type ModuleGroup } from "@/modules/core/module-registry";

const groups: readonly { key: ModuleGroup; label: string }[] = [
  { key: "work", label: "Work" },
  { key: "finance", label: "Finance" },
  { key: "operations", label: "Operations" },
  { key: "insights", label: "Insights" },
  { key: "settings", label: "Settings" },
];

function businessHref(href: string, businessId: string) {
  return href.replace(/^\/business/, `/business/${businessId}`);
}

export function BusinessShell({
  children,
  context,
  user,
}: {
  children: React.ReactNode;
  context: {
    businessId: string;
    businessName: string;
    tenantName: string;
    roleKey: string;
    planName: string;
    enabledFeatures: string[];
  };
  user: { name: string; email: string };
}) {
  const enabledFeatures = new Set(context.enabledFeatures);
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      entries: modulesByGroup(group.key).filter(
        (entry) => entry.status === "foundation"
          && hasBusinessCapability(context.roleKey, entry.permission)
          && enabledFeatures.has(entry.entitlement),
      ),
    }))
    .filter((group) => group.entries.length > 0);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-r border-[var(--border)] bg-[var(--surface)] p-4">
        <Link href="/businesses" className="block rounded-xl border border-[var(--border)] p-4 transition hover:bg-[var(--surface-muted)]">
          <span className="block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Active business</span>
          <strong className="mt-1 block truncate">{context.businessName}</strong>
          <span className="text-sm text-[var(--muted)]">Switch business</span>
        </Link>
        <nav className="mt-6 space-y-6" aria-label="Business navigation">
          {visibleGroups.map((group) => (
            <div key={group.key}>
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{group.label}</p>
              <div className="space-y-1">
                {group.entries.map((entry) => (
                  <Link key={entry.key} href={businessHref(entry.href, context.businessId)} className="block rounded-lg px-3 py-2 text-sm transition hover:bg-[var(--surface-muted)]">
                    {entry.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <p className="mt-8 px-3 text-xs leading-5 text-[var(--muted)]">Modules appear only when implemented, permitted by the active role, and enabled by the tenant plan.</p>
      </aside>
      <div>
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{context.tenantName} · {context.roleKey.replace("business.", "")} · {context.planName}</p>
            <strong>{context.businessName}</strong>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-[var(--muted)]">{user.email}</p>
            </div>
            <Link href="/businesses" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm transition hover:bg-[var(--surface-muted)]">Account Hub</Link>
            <SignOutButton compact />
          </div>
        </header>
        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
