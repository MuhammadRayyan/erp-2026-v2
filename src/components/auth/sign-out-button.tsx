"use client";

import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  async function handleSignOut() {
    await authClient.signOut();
    window.location.assign("/sign-in");
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm transition hover:bg-[var(--surface-muted)]"
    >
      <LogOut size={16} />
      {!compact && <span>Sign out</span>}
    </button>
  );
}
