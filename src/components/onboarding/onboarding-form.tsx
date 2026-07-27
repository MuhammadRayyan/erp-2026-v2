"use client";

import { useState } from "react";
import { ArrowRight, Building2, LoaderCircle } from "lucide-react";

export function OnboardingForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        tenantName: String(form.get("tenantName") ?? "").trim(),
        businessLegalName: String(form.get("businessLegalName") ?? "").trim(),
        businessTradingName: String(form.get("businessTradingName") ?? "").trim() || undefined,
        baseCurrency: String(form.get("baseCurrency") ?? "AED"),
        timezone: String(form.get("timezone") ?? "Asia/Dubai"),
      }),
    });

    const result = (await response.json()) as {
      businessId?: string;
      message?: string;
    };

    if (!response.ok || !result.businessId) {
      setError(result.message ?? "The business could not be created.");
      setPending(false);
      return;
    }

    window.location.assign(`/business/${result.businessId}/dashboard`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Account or group name</span>
          <input name="tenantName" required maxLength={120} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--brand)]" placeholder="Rayyan Business Group" />
          <span className="mt-1 block text-xs text-[var(--muted)]">This groups your businesses, users, subscription, and shared account administration.</span>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Legal business name</span>
          <input name="businessLegalName" required maxLength={160} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--brand)]" placeholder="Example Technical Services LLC" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Trading name <span className="font-normal text-[var(--muted)]">(optional)</span></span>
          <input name="businessTradingName" maxLength={160} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--brand)]" placeholder="Example Technical Services" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Base currency</span>
          <select name="baseCurrency" defaultValue="AED" className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--brand)]">
            <option value="AED">AED — UAE Dirham</option>
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="SAR">SAR — Saudi Riyal</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Business timezone</span>
          <select name="timezone" defaultValue="Asia/Dubai" className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--brand)]">
            <option value="Asia/Dubai">Asia/Dubai</option>
            <option value="Europe/Berlin">Europe/Berlin</option>
            <option value="Asia/Karachi">Asia/Karachi</option>
          </select>
        </label>
      </div>

      {error && <p role="alert" className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-4 py-3 text-sm text-[var(--danger)]">{error}</p>}

      <button type="submit" disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-3.5 font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60">
        {pending ? <LoaderCircle className="animate-spin" size={19} /> : <Building2 size={19} />}
        {pending ? "Creating your workspace…" : "Create business and continue"}
        {!pending && <ArrowRight size={18} />}
      </button>
    </form>
  );
}
