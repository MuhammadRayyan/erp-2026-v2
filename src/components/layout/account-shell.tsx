import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";

export function AccountShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name: string; email: string };
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/businesses" className="font-semibold tracking-tight">ERP 2026</Link>
            <span className="hidden text-sm text-[var(--muted)] sm:inline">Account Hub</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-[var(--muted)]">{user.email}</p>
            </div>
            <SignOutButton compact />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
