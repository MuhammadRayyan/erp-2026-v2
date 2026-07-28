"use client";

import { useState } from "react";

export function PartyCreateForm({ businessId }: { businessId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const type = String(form.get("type"));
    const roles = form.getAll("roles").map(String);
    const payload = {
      type,
      roles,
      legalName: String(form.get("legalName") ?? ""),
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      taxRegistrationNumber: String(form.get("taxRegistrationNumber") ?? ""),
      contact: form.get("contactName") ? {
        name: String(form.get("contactName")),
        jobTitle: String(form.get("contactJobTitle") ?? ""),
        email: String(form.get("contactEmail") ?? ""),
        phone: String(form.get("contactPhone") ?? ""),
      } : undefined,
      address: form.get("addressLine1") ? {
        type: String(form.get("addressType")),
        line1: String(form.get("addressLine1")),
        city: String(form.get("city") ?? ""),
        emirate: String(form.get("emirate") ?? ""),
        countryCode: "AE",
      } : undefined,
    };

    const response = await fetch(`/api/businesses/${businessId}/parties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.message ?? "The party could not be created.");
      setPending(false);
      return;
    }
    setMessage("Party created.");
    event.currentTarget.reset();
    setPending(false);
    window.location.reload();
  }

  const inputClass = "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 outline-none focus:border-[var(--brand)]";

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div>
        <p className="text-sm font-medium text-[var(--brand)]">New party</p>
        <h2 className="mt-1 text-xl font-semibold">Add customer or supplier</h2>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-medium">Type<select name="type" className={inputClass}><option value="ORGANIZATION">Organization</option><option value="INDIVIDUAL">Individual</option></select></label>
        <label className="text-sm font-medium">Organization name<input name="legalName" className={inputClass} /></label>
        <label className="text-sm font-medium">First name<input name="firstName" className={inputClass} /></label>
        <label className="text-sm font-medium">Last name<input name="lastName" className={inputClass} /></label>
        <label className="text-sm font-medium">Email<input name="email" type="email" className={inputClass} /></label>
        <label className="text-sm font-medium">Phone<input name="phone" className={inputClass} /></label>
        <label className="text-sm font-medium">TRN<input name="taxRegistrationNumber" inputMode="numeric" maxLength={15} className={inputClass} /></label>
        <fieldset className="text-sm font-medium"><legend>Roles</legend><div className="mt-3 flex gap-4"><label><input type="checkbox" name="roles" value="CUSTOMER" defaultChecked /> Customer</label><label><input type="checkbox" name="roles" value="SUPPLIER" /> Supplier</label></div></fieldset>
      </div>
      <details className="mt-5 rounded-xl bg-[var(--surface-muted)] p-4">
        <summary className="cursor-pointer font-medium">Primary contact and address</summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium">Contact name<input name="contactName" className={inputClass} /></label>
          <label className="text-sm font-medium">Job title<input name="contactJobTitle" className={inputClass} /></label>
          <label className="text-sm font-medium">Contact email<input name="contactEmail" type="email" className={inputClass} /></label>
          <label className="text-sm font-medium">Contact phone<input name="contactPhone" className={inputClass} /></label>
          <label className="text-sm font-medium">Address type<select name="addressType" className={inputClass}><option value="BILLING">Billing</option><option value="DELIVERY">Delivery</option><option value="SITE">Site</option><option value="OTHER">Other</option></select></label>
          <label className="text-sm font-medium">Address line<input name="addressLine1" className={inputClass} /></label>
          <label className="text-sm font-medium">City<input name="city" className={inputClass} /></label>
          <label className="text-sm font-medium">Emirate<input name="emirate" className={inputClass} /></label>
        </div>
      </details>
      <div className="mt-5 flex items-center gap-3"><button disabled={pending} className="rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white disabled:opacity-60">{pending ? "Creating…" : "Create party"}</button>{message && <p className="text-sm text-[var(--muted)]">{message}</p>}</div>
    </form>
  );
}
