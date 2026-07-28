"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Definition = {
  id: string;
  entityType: "PARTY" | "CATALOG_ITEM";
  key: string;
  label: string;
  description: string | null;
  valueType: "TEXT" | "LONG_TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT";
  required: boolean;
  active: boolean;
  sortOrder: number;
  options: unknown;
};

function optionText(options: unknown) {
  return Array.isArray(options) ? options.filter((value): value is string => typeof value === "string").join("\n") : "";
}

function optionsFromText(value: string) {
  return value.split(/\r?\n|,/).map((option) => option.trim()).filter(Boolean);
}

async function post(businessId: string, body: unknown) {
  const response = await fetch(`/api/businesses/${businessId}/custom-fields`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "The custom field could not be saved.");
}

export function CustomFieldDefinitionsManager({ businessId, definitions, editable }: { businessId: string; definitions: Definition[]; editable: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function create(formData: FormData) {
    setPending(true); setMessage("");
    try {
      const valueType = String(formData.get("valueType"));
      await post(businessId, { action: "create-definition", data: {
        entityType: String(formData.get("entityType")), key: String(formData.get("key")), label: String(formData.get("label")), description: String(formData.get("description") || "") || null,
        valueType, required: formData.get("required") === "on", active: true, sortOrder: Number(formData.get("sortOrder") || 0), options: valueType === "SELECT" ? optionsFromText(String(formData.get("options") || "")) : null,
      } });
      setMessage("Custom field created."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The custom field could not be created."); }
    finally { setPending(false); }
  }

  async function update(definition: Definition, formData: FormData) {
    setPending(true); setMessage("");
    try {
      await post(businessId, { action: "update-definition", definitionId: definition.id, data: {
        label: String(formData.get("label")), description: String(formData.get("description") || "") || null, required: formData.get("required") === "on", active: formData.get("active") === "on",
        sortOrder: Number(formData.get("sortOrder") || 0), options: definition.valueType === "SELECT" ? optionsFromText(String(formData.get("options") || "")) : null,
      } });
      setMessage("Custom field updated."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The custom field could not be updated."); }
    finally { setPending(false); }
  }

  return <div className="space-y-6">
    {editable && <form action={create} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-lg font-semibold">Create custom field</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm">Applies to<select name="entityType" className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"><option value="PARTY">Customers and suppliers</option><option value="CATALOG_ITEM">Items and services</option></select></label>
        <label className="text-sm">Key<input name="key" required placeholder="service_zone" className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5" /></label>
        <label className="text-sm">Label<input name="label" required className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5" /></label>
        <label className="text-sm">Type<select name="valueType" className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"><option value="TEXT">Text</option><option value="LONG_TEXT">Long text</option><option value="NUMBER">Number</option><option value="DATE">Date</option><option value="BOOLEAN">Yes / no</option><option value="SELECT">Select</option></select></label>
        <label className="text-sm md:col-span-2">Description<input name="description" className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5" /></label>
        <label className="text-sm">Order<input name="sortOrder" type="number" min="0" defaultValue="0" className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5" /></label>
        <label className="mt-7 flex items-center gap-2 text-sm"><input name="required" type="checkbox" /> Required</label>
        <label className="text-sm md:col-span-2 xl:col-span-4">Select options, one per line<textarea name="options" rows={3} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5" /></label>
      </div>
      <button disabled={pending} className="mt-4 rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white disabled:opacity-50">Create field</button>
    </form>}

    {message && <p className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-sm">{message}</p>}

    <div className="grid gap-4 lg:grid-cols-2">{definitions.map((definition) => <form key={definition.id} action={(formData) => update(definition, formData)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-wide text-[var(--brand)]">{definition.entityType === "PARTY" ? "Customers and suppliers" : "Items and services"}</p><h3 className="mt-1 font-semibold">{definition.label}</h3><p className="mt-1 font-mono text-xs text-[var(--muted)]">{definition.key} · {definition.valueType.toLowerCase()}</p></div><span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs">{definition.active ? "active" : "inactive"}</span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Label<input name="label" defaultValue={definition.label} disabled={!editable} required className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 disabled:opacity-70" /></label>
        <label className="text-sm">Order<input name="sortOrder" type="number" min="0" defaultValue={definition.sortOrder} disabled={!editable} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 disabled:opacity-70" /></label>
        <label className="text-sm sm:col-span-2">Description<input name="description" defaultValue={definition.description || ""} disabled={!editable} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 disabled:opacity-70" /></label>
        {definition.valueType === "SELECT" && <label className="text-sm sm:col-span-2">Options<textarea name="options" rows={3} defaultValue={optionText(definition.options)} disabled={!editable} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 disabled:opacity-70" /></label>}
      </div>
      <div className="mt-4 flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input name="required" type="checkbox" defaultChecked={definition.required} disabled={!editable} /> Required</label><label className="flex items-center gap-2"><input name="active" type="checkbox" defaultChecked={definition.active} disabled={!editable} /> Active</label></div>
      {editable && <button disabled={pending} className="mt-4 rounded-xl border border-[var(--border)] px-4 py-2.5 font-medium disabled:opacity-50">Save definition</button>}
    </form>)}</div>
    {definitions.length === 0 && <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted)]">No custom fields have been defined.</div>}
  </div>;
}
