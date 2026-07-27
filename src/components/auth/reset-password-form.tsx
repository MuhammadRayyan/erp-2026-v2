"use client";

import { useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : "The reset link is missing or invalid.");
  const [complete, setComplete] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (password.length < 10) {
      setError("Use at least 10 characters.");
      return;
    }

    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setPending(true);
    setError(null);
    const result = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);

    if (result.error) {
      setError(result.error.message ?? "The reset link is invalid or expired.");
      return;
    }

    setComplete(true);
  }

  if (complete) {
    return (
      <div className="rounded-xl bg-[var(--surface-muted)] p-5 text-sm">
        <div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} /> Password updated</div>
        <p className="mt-2 text-[var(--muted)]">Other sessions have been revoked. Return to sign in with the new password.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block">
        <span className="text-sm font-medium">New password</span>
        <input name="password" type="password" autoComplete="new-password" required minLength={10} disabled={!token} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--brand)] disabled:opacity-60" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Confirm password</span>
        <input name="confirmation" type="password" autoComplete="new-password" required minLength={10} disabled={!token} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--brand)] disabled:opacity-60" />
      </label>
      {error && <p role="alert" className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-4 py-3 text-sm text-[var(--danger)]">{error}</p>}
      <button type="submit" disabled={pending || !token} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:opacity-60">
        {pending && <LoaderCircle className="animate-spin" size={18} />}
        {pending ? "Updating…" : "Set new password"}
      </button>
    </form>
  );
}
