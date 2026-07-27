"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function SignUpForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (password !== confirmation) {
      setError("Passwords do not match.");
      setPending(false);
      return;
    }

    const result = await authClient.signUp.email({
      name,
      email,
      password,
    });

    if (result.error) {
      setError(result.error.message ?? "Unable to create the account.");
      setPending(false);
      return;
    }

    window.location.assign("/businesses/new");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block">
        <span className="text-sm font-medium">Your name</span>
        <input name="name" autoComplete="name" required className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--brand)]" placeholder="Business owner" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Email address</span>
        <input name="email" type="email" autoComplete="email" required className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--brand)]" placeholder="you@business.com" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input name="password" type="password" autoComplete="new-password" minLength={10} required className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--brand)]" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Confirm</span>
          <input name="confirmation" type="password" autoComplete="new-password" minLength={10} required className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--brand)]" />
        </label>
      </div>
      <p className="text-xs leading-5 text-[var(--muted)]">Use at least 10 characters. Additional security controls can be enabled later without changing your business data.</p>
      {error && <p role="alert" className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-4 py-3 text-sm text-[var(--danger)]">{error}</p>}
      <button type="submit" disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60">
        {pending ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowRight size={18} />}
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
