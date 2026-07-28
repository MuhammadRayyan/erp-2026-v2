"use client";

import { useState } from "react";

const fieldClass = "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 outline-none focus:border-[var(--brand)] disabled:opacity-70";

type UnitOption = { id: string; code: string; name: string; active: boolean };
type ItemDetail = {
  id: string;
  type: "PRODUCT" | "SERVICE";
  status: "ACTIVE" | "INACTIVE";
  sku: string | null;
  name: string;
  description: string | null;
  unitId: string;
  salesEnabled: boolean;
  purchaseEnabled: boolean;
  defaultSalesPrice: string | null;
  defaultPurchasePrice: string | null;
  salesAccountClassKey: string;
  purchaseAccountClassKey: string;
  defaultSalesTaxCategory: string;
  defaultPurchaseTaxCategory: string;
};

export function CatalogItemEditor({ businessId, item, units, canManage }: { businessId: string; item: ItemDetail; units: UnitOption[]; canManage: boolean }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const endpoint = `/api/businesses/${businessId}/catalog/${item.id}`;

  async function send(body: unknown) {
    setPending(true);
    setMessage(null);
    const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.message ?? "The catalog item could not be updated.");
      setPending(false);
      return;
    }
    setMessage("Saved.");
    window.location.reload();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await send({
      data: {
        type: form.get("type"),
        sku: form.get("sku"),
        name: form.get("name"),
        description: form.get("description"),
        unitId: form.get("unitId"),
        salesEnabled: form.get("salesEnabled") === "on",
        purchaseEnabled: form.get("purchaseEnabled") === "on",
        defaultSalesPrice: form.get("defaultSalesPrice"),
        defaultPurchasePrice: form.get("defaultPurchasePrice"),
        salesAccountClassKey: form.get("salesAccountClassKey"),
        purchaseAccountClassKey: form.get("purchaseAccountClassKey"),
        defaultSalesTaxCategory: form.get("defaultSalesTaxCategory"),
        defaultPurchaseTaxCategory: form.get("defaultPurchaseTaxCategory"),
      },
    });
  }

  return <form onSubmit={submit} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-medium text-[var(--brand)]">Catalog profile</p><h2 className="mt-1 text-xl font-semibold">Commercial defaults</h2><p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">These values prepare future documents. They do not create accounting entries or determine statutory VAT by themselves.</p></div>
      {canManage && <button type="button" disabled={pending} onClick={() => send({ action: "status", data: { status: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" } })} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-medium disabled:opacity-60">{item.status === "ACTIVE" ? "Deactivate" : "Reactivate"}</button>}
    </div>
    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="text-sm font-medium">Type<select name="type" defaultValue={item.type} disabled={!canManage} className={fieldClass}><option value="PRODUCT">Product</option><option value="SERVICE">Service</option></select></label>
      <label className="text-sm font-medium">SKU<input name="sku" defaultValue={item.sku ?? ""} disabled={!canManage} className={fieldClass} /></label>
      <label className="text-sm font-medium md:col-span-2">Name<input name="name" defaultValue={item.name} required disabled={!canManage} className={fieldClass} /></label>
      <label className="text-sm font-medium">Unit<select name="unitId" defaultValue={item.unitId} disabled={!canManage} className={fieldClass}>{units.filter((unit) => unit.active || unit.id === item.unitId).map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.code}){unit.active ? "" : " — inactive"}</option>)}</select></label>
      <label className="text-sm font-medium">Sales price<input name="defaultSalesPrice" defaultValue={item.defaultSalesPrice ?? ""} inputMode="decimal" disabled={!canManage} className={fieldClass} /></label>
      <label className="text-sm font-medium">Purchase price<input name="defaultPurchasePrice" defaultValue={item.defaultPurchasePrice ?? ""} inputMode="decimal" disabled={!canManage} className={fieldClass} /></label>
      <fieldset className="text-sm font-medium"><legend>Available for</legend><div className="mt-3 flex gap-4"><label><input name="salesEnabled" type="checkbox" defaultChecked={item.salesEnabled} disabled={!canManage} /> Sales</label><label><input name="purchaseEnabled" type="checkbox" defaultChecked={item.purchaseEnabled} disabled={!canManage} /> Purchases</label></div></fieldset>
      <label className="text-sm font-medium">Sales class<select name="salesAccountClassKey" defaultValue={item.salesAccountClassKey} disabled={!canManage} className={fieldClass}><option value="SALES_REVENUE">Sales revenue</option><option value="SERVICE_REVENUE">Service revenue</option></select></label>
      <label className="text-sm font-medium">Purchase class<select name="purchaseAccountClassKey" defaultValue={item.purchaseAccountClassKey} disabled={!canManage} className={fieldClass}><option value="INVENTORY_PURCHASES">Inventory purchases</option><option value="DIRECT_EXPENSE">Direct expense</option><option value="OPERATING_EXPENSE">Operating expense</option></select></label>
      <label className="text-sm font-medium">Sales tax category<select name="defaultSalesTaxCategory" defaultValue={item.defaultSalesTaxCategory} disabled={!canManage} className={fieldClass}><option value="UNSPECIFIED">Unspecified</option><option value="STANDARD_RATE">Standard rate</option><option value="ZERO_RATED">Zero-rated</option><option value="EXEMPT">Exempt</option><option value="OUT_OF_SCOPE">Out of scope</option></select></label>
      <label className="text-sm font-medium">Purchase tax category<select name="defaultPurchaseTaxCategory" defaultValue={item.defaultPurchaseTaxCategory} disabled={!canManage} className={fieldClass}><option value="UNSPECIFIED">Unspecified</option><option value="STANDARD_RATE">Standard rate</option><option value="ZERO_RATED">Zero-rated</option><option value="EXEMPT">Exempt</option><option value="OUT_OF_SCOPE">Out of scope</option></select></label>
    </div>
    <label className="mt-4 block text-sm font-medium">Description<textarea name="description" defaultValue={item.description ?? ""} rows={4} disabled={!canManage} className={fieldClass} /></label>
    {canManage && <button disabled={pending} className="mt-4 rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white disabled:opacity-60">{pending ? "Saving…" : "Save catalog item"}</button>}
    {message && <p className="mt-3 text-sm text-[var(--muted)]">{message}</p>}
  </form>;
}
