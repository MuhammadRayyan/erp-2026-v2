"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Field = {
  definition: {
    id: string;
    label: string;
    description: string | null;
    valueType: "TEXT" | "LONG_TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT";
    required: boolean;
    options: string[];
  };
  value: string | boolean | null;
};

export function CustomFieldsEditor({ businessId, entityType, entityId, fields, editable }: { businessId: string; entityType: "PARTY" | "CATALOG_ITEM"; entityId: string; fields: Field[]; editable: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function save(formData: FormData) {
    setPending(true); setMessage("");
    const values = fields.map(({ definition }) => {
      const raw = formData.get(definition.id);
      let value: string | boolean | null = raw === null ? null : String(raw);
      if (definition.valueType === "BOOLEAN") value = raw === "true" ? true : raw === "false" ? false : null;
      return { definitionId: definition.id, value };
    });
    try {
      const response = await fetch(`/api/businesses/${businessId}/custom-fields`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save-values", entityType, entityId, data: { values } }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "The custom fields could not be saved.");
      setMessage("Custom fields saved."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The custom fields could not be saved."); }
    finally { setPending(false); }
  }

  if (fields.length === 0) return null;
  return <form action={save} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
    <div><p className="text-sm font-medium text-[var(--brand)]">Additional information</p><h2 className="mt-1 text-lg font-semibold">Custom fields</h2></div>
    <div className="mt-5 grid gap-4 md:grid-cols-2">{fields.map(({ definition, value }) => {
      const common = "mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 disabled:opacity-70";
      return <label key={definition.id} className={`text-sm ${definition.valueType === "LONG_TEXT" ? "md:col-span-2" : ""}`}>
        <span>{definition.label}{definition.required ? " *" : ""}</span>{definition.description && <span className="ml-2 text-xs text-[var(--muted)]">{definition.description}</span>}
        {definition.valueType === "LONG_TEXT" ? <textarea name={definition.id} rows={4} defaultValue={typeof value === "string" ? value : ""} required={definition.required} disabled={!editable} className={common} />
          : definition.valueType === "SELECT" ? <select name={definition.id} defaultValue={typeof value === "string" ? value : ""} required={definition.required} disabled={!editable} className={common}><option value="">Not set</option>{definition.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          : definition.valueType === "BOOLEAN" ? <select name={definition.id} defaultValue={typeof value === "boolean" ? String(value) : ""} required={definition.required} disabled={!editable} className={common}><option value="">Not set</option><option value="true">Yes</option><option value="false">No</option></select>
          : <input name={definition.id} type={definition.valueType === "NUMBER" ? "text" : definition.valueType === "DATE" ? "date" : "text"} inputMode={definition.valueType === "NUMBER" ? "decimal" : undefined} defaultValue={typeof value === "string" ? value : ""} required={definition.required} disabled={!editable} className={common} />}
      </label>;
    })}</div>
    {message && <p className="mt-4 rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-sm">{message}</p>}
    {editable && <button disabled={pending} className="mt-5 rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white disabled:opacity-50">Save custom fields</button>}
  </form>;
}
