"use client";

import { useState } from "react";
import { LoaderCircle, Mail } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setPending(false);
    setMessage(result.error
      ? "The request could not be processed. Check the email service and try again."
      : "If an account exists for that address, a password reset email has been sent.");
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block">
        <span className="text-sm font-medium">Email address</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--brand)]"
          placeholder="you@business.com"
        />
      </label>
      {message && <p role="status" className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--muted)]">{message}</p>}
      <button type="submit" disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:opacity-60">
        {pending ? <LoaderCircle className="animate-spin" size={18} /> : <Mail size={18} />}
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
