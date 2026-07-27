"use client";

import { useState } from "react";
import type { BusinessProfileInput } from "@/modules/business-settings/contracts/business-profile";

const industryOptions = [
  ["", "Not selected"],
  ["GENERAL_SERVICES", "General services"],
  ["TECHNICAL_SERVICES", "Technical services"],
  ["AUTOMOTIVE_WORKSHOP", "Automotive workshop"],
  ["CIVIL_ARCHITECTURAL", "Civil / architectural"],
  ["GENERAL_TRADING", "General trading"],
] as const;

const monthOptions = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function BusinessProfileForm({
  businessId,
  initial,
  editable,
}: {
  businessId: string;
  initial: {
    industryProfile: string | null;
    legalForm: string | null;
    tradeLicenseNumber: string | null;
    tradeLicenseAuthority: string | null;
    vatRegistrationStatus: string;
    trn: string | null;
    vatEffectiveFrom: string | null;
    fiscalYearStartMonth: number;
    documentLanguage: string;
  };
  editable: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable) return;
    setPending(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const payload: BusinessProfileInput = {
      industryProfile: String(form.get("industryProfile") || "") || null,
      legalForm: String(form.get("legalForm") || ""),
      tradeLicenseNumber: String(form.get("tradeLicenseNumber") || ""),
      tradeLicenseAuthority: String(form.get("tradeLicenseAuthority") || ""),
      vatRegistrationStatus: String(form.get("vatRegistrationStatus")),
      trn: String(form.get("trn") || ""),
      vatEffectiveFrom: String(form.get("vatEffectiveFrom") || "") || null,
      fiscalYearStartMonth: Number(form.get("fiscalYearStartMonth")),
      documentLanguage: String(form.get("documentLanguage")),
    } as BusinessProfileInput;

    const response = await fetch(`/api/businesses/${businessId}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    setMessage(response.ok ? "Business profile saved." : result.message ?? "The profile could not be saved.");
    setPending(false);
  }

  const inputClass = "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 outline-none transition focus:border-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-70";

  return (
    <form onSubmit={submit} className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold">Business classification</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">The profile controls practical defaults and terminology without creating a separate product.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">Industry profile
            <select name="industryProfile" defaultValue={initial.industryProfile ?? ""} disabled={!editable} className={inputClass}>
              {industryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Document language
            <select name="documentLanguage" defaultValue={initial.documentLanguage} disabled={!editable} className={inputClass}>
              <option value="ENGLISH">English</option>
              <option value="ARABIC">Arabic</option>
              <option value="BILINGUAL">English and Arabic</option>
            </select>
          </label>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Legal and licensing identity</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium">Legal form
            <input name="legalForm" defaultValue={initial.legalForm ?? ""} disabled={!editable} className={inputClass} placeholder="LLC, sole establishment…" />
          </label>
          <label className="text-sm font-medium">Trade license number
            <input name="tradeLicenseNumber" defaultValue={initial.tradeLicenseNumber ?? ""} disabled={!editable} className={inputClass} />
          </label>
          <label className="text-sm font-medium">Licensing authority
            <input name="tradeLicenseAuthority" defaultValue={initial.tradeLicenseAuthority ?? ""} disabled={!editable} className={inputClass} placeholder="DED / free-zone authority" />
          </label>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">UAE VAT and fiscal settings</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Registered status requires a 15-digit TRN and effective date. These settings will feed the later tax engine and document snapshots.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium">VAT status
            <select name="vatRegistrationStatus" defaultValue={initial.vatRegistrationStatus} disabled={!editable} className={inputClass}>
              <option value="NOT_REGISTERED">Not registered</option>
              <option value="REGISTERED">Registered</option>
              <option value="DEREGISTERED">Deregistered</option>
            </select>
          </label>
          <label className="text-sm font-medium">Tax registration number
            <input name="trn" inputMode="numeric" maxLength={15} defaultValue={initial.trn ?? ""} disabled={!editable} className={inputClass} placeholder="15 digits" />
          </label>
          <label className="text-sm font-medium">VAT effective from
            <input name="vatEffectiveFrom" type="date" defaultValue={initial.vatEffectiveFrom ?? ""} disabled={!editable} className={inputClass} />
          </label>
          <label className="text-sm font-medium">Fiscal year starts
            <select name="fiscalYearStartMonth" defaultValue={initial.fiscalYearStartMonth} disabled={!editable} className={inputClass}>
              {monthOptions.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
            </select>
          </label>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-5">
        {editable ? (
          <button disabled={pending} className="rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white disabled:opacity-60">
            {pending ? "Saving…" : "Save business profile"}
          </button>
        ) : (
          <p className="text-sm text-[var(--muted)]">Your role can view these settings but cannot change them.</p>
        )}
        {message && <p role="status" className="text-sm text-[var(--muted)]">{message}</p>}
      </div>
    </form>
  );
}
