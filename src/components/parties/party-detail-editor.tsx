"use client";

import { useState } from "react";

const fieldClass = "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 outline-none focus:border-[var(--brand)]";

type PartyDetail = {
  id: string;
  type: "ORGANIZATION" | "INDIVIDUAL";
  status: "ACTIVE" | "INACTIVE";
  legalName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  taxRegistrationNumber: string | null;
  notes: string | null;
  roles: Array<{ role: "CUSTOMER" | "SUPPLIER" }>;
  contacts: Array<{ id: string; name: string; jobTitle: string | null; email: string | null; phone: string | null; isPrimary: boolean }>;
  addresses: Array<{ id: string; type: "BILLING" | "DELIVERY" | "SITE" | "OTHER"; label: string | null; line1: string; city: string | null; emirate: string | null; countryCode: string; isDefault: boolean }>;
};

export function PartyDetailEditor({ businessId, party, canManage }: { businessId: string; party: PartyDetail; canManage: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const endpoint = `/api/businesses/${businessId}/parties/${party.id}`;

  async function send(url: string, method: string, body: unknown) {
    setMessage(null);
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.message ?? "Update failed."); return false; }
    setMessage("Saved.");
    window.location.reload();
    return true;
  }

  async function updateParty(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await send(endpoint, "PATCH", {
      type: form.get("type"), roles: form.getAll("roles"), legalName: form.get("legalName"), firstName: form.get("firstName"), lastName: form.get("lastName"),
      email: form.get("email"), phone: form.get("phone"), taxRegistrationNumber: form.get("taxRegistrationNumber"), notes: form.get("notes"),
    });
  }

  async function addContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await send(`${endpoint}/related`, "POST", { action: "add-contact", data: { name: form.get("name"), jobTitle: form.get("jobTitle"), email: form.get("email"), phone: form.get("phone"), isPrimary: form.get("isPrimary") === "on" } });
  }

  async function addAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await send(`${endpoint}/related`, "POST", { action: "add-address", data: { type: form.get("type"), label: form.get("label"), line1: form.get("line1"), city: form.get("city"), emirate: form.get("emirate"), countryCode: "AE", isDefault: form.get("isDefault") === "on" } });
  }

  return <div className="space-y-6">
    <form onSubmit={updateParty} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium text-[var(--brand)]">Party profile</p><h2 className="mt-1 text-xl font-semibold">Identity and commercial roles</h2></div>{canManage && <button type="button" onClick={() => send(endpoint, "PATCH", { action: "status", status: party.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-medium">{party.status === "ACTIVE" ? "Deactivate" : "Reactivate"}</button>}</div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-medium">Type<select name="type" defaultValue={party.type} disabled={!canManage} className={fieldClass}><option value="ORGANIZATION">Organization</option><option value="INDIVIDUAL">Individual</option></select></label>
        <label className="text-sm font-medium">Organization name<input name="legalName" defaultValue={party.legalName ?? ""} disabled={!canManage} className={fieldClass} /></label>
        <label className="text-sm font-medium">First name<input name="firstName" defaultValue={party.firstName ?? ""} disabled={!canManage} className={fieldClass} /></label>
        <label className="text-sm font-medium">Last name<input name="lastName" defaultValue={party.lastName ?? ""} disabled={!canManage} className={fieldClass} /></label>
        <label className="text-sm font-medium">Email<input name="email" type="email" defaultValue={party.email ?? ""} disabled={!canManage} className={fieldClass} /></label>
        <label className="text-sm font-medium">Phone<input name="phone" defaultValue={party.phone ?? ""} disabled={!canManage} className={fieldClass} /></label>
        <label className="text-sm font-medium">TRN<input name="taxRegistrationNumber" defaultValue={party.taxRegistrationNumber ?? ""} disabled={!canManage} className={fieldClass} /></label>
        <fieldset className="text-sm font-medium"><legend>Roles</legend><div className="mt-3 flex gap-4"><label><input type="checkbox" name="roles" value="CUSTOMER" defaultChecked={party.roles.some((r) => r.role === "CUSTOMER")} disabled={!canManage} /> Customer</label><label><input type="checkbox" name="roles" value="SUPPLIER" defaultChecked={party.roles.some((r) => r.role === "SUPPLIER")} disabled={!canManage} /> Supplier</label></div></fieldset>
      </div>
      <label className="mt-4 block text-sm font-medium">Notes<textarea name="notes" defaultValue={party.notes ?? ""} disabled={!canManage} rows={3} className={fieldClass} /></label>
      {canManage && <button className="mt-4 rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white">Save party</button>}
    </form>

    <section className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-lg font-semibold">Contacts</h2><div className="mt-4 space-y-3">{party.contacts.map((contact) => <div key={contact.id} className="rounded-xl bg-[var(--surface-muted)] p-3"><div className="flex justify-between gap-3"><div><p className="font-medium">{contact.name}</p><p className="text-sm text-[var(--muted)]">{contact.jobTitle || contact.email || contact.phone || "No additional details"}</p></div>{contact.isPrimary ? <span className="text-xs font-medium text-[var(--brand)]">Primary</span> : canManage && <button onClick={() => send(`${endpoint}/related`, "POST", { action: "primary-contact", contactId: contact.id })} className="text-xs font-medium">Make primary</button>}</div></div>)}</div>{canManage && <form onSubmit={addContact} className="mt-5 grid gap-3 md:grid-cols-2"><input name="name" required placeholder="Contact name" className={fieldClass} /><input name="jobTitle" placeholder="Job title" className={fieldClass} /><input name="email" type="email" placeholder="Email" className={fieldClass} /><input name="phone" placeholder="Phone" className={fieldClass} /><label className="text-sm"><input name="isPrimary" type="checkbox" /> Make primary</label><button className="rounded-xl border border-[var(--border)] px-3 py-2 font-medium">Add contact</button></form>}</div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-lg font-semibold">Addresses</h2><div className="mt-4 space-y-3">{party.addresses.map((address) => <div key={address.id} className="rounded-xl bg-[var(--surface-muted)] p-3"><div className="flex justify-between gap-3"><div><p className="font-medium">{address.label || address.type.toLowerCase()}</p><p className="text-sm text-[var(--muted)]">{[address.line1, address.city, address.emirate].filter(Boolean).join(", ")}</p></div>{address.isDefault ? <span className="text-xs font-medium text-[var(--brand)]">Default</span> : canManage && <button onClick={() => send(`${endpoint}/related`, "POST", { action: "default-address", addressId: address.id })} className="text-xs font-medium">Make default</button>}</div></div>)}</div>{canManage && <form onSubmit={addAddress} className="mt-5 grid gap-3 md:grid-cols-2"><select name="type" className={fieldClass}><option value="BILLING">Billing</option><option value="DELIVERY">Delivery</option><option value="SITE">Site</option><option value="OTHER">Other</option></select><input name="label" placeholder="Label" className={fieldClass} /><input name="line1" required placeholder="Address line" className={fieldClass} /><input name="city" placeholder="City" className={fieldClass} /><input name="emirate" placeholder="Emirate" className={fieldClass} /><label className="text-sm"><input name="isDefault" type="checkbox" /> Make default for this type</label><button className="rounded-xl border border-[var(--border)] px-3 py-2 font-medium">Add address</button></form>}</div>
    </section>
    {message && <p className="text-sm text-[var(--muted)]">{message}</p>}
  </div>;
}
