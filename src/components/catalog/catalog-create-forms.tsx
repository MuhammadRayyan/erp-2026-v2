"use client";

import { useState } from "react";

const fieldClass = "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 outline-none focus:border-[var(--brand)]";

type UnitOption = { id: string; code: string; name: string; symbol: string | null; dimension: string; decimalPlaces: number };

export function CatalogCreateForms({ businessId, units }: { businessId: string; units: UnitOption[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const endpoint = `/api/businesses/${businessId}/catalog`;

  async function send(body: unknown) {
    setPending(true);
    setMessage(null);
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.message ?? "The catalog change could not be saved.");
      setPending(false);
      return false;
    }
    setMessage("Saved.");
    setPending(false);
    window.location.reload();
    return true;
  }

  async function createItem(event: React.FormEvent<HTMLFormElement>) {
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

  async function createUnit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await send({ action: "create-unit", data: { code: form.get("code"), name: form.get("name"), symbol: form.get("symbol"), dimension: form.get("dimension"), decimalPlaces: form.get("decimalPlaces") } });
  }

  return <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
    <form onSubmit={createItem} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <p className="text-sm font-medium text-[var(--brand)]">New catalog record</p>
      <h2 className="mt-1 text-xl font-semibold">Add product or service</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">Prices are stored as exact decimals. Account and tax values are defaults for future sales, purchase, accounting, and VAT workflows.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-medium">Type<select name="type" className={fieldClass}><option value="PRODUCT">Product</option><option value="SERVICE">Service</option></select></label>
        <label className="text-sm font-medium">SKU<input name="sku" maxLength={60} className={fieldClass} /></label>
        <label className="text-sm font-medium md:col-span-2">Name<input name="name" required className={fieldClass} /></label>
        <label className="text-sm font-medium">Unit<select name="unitId" required className={fieldClass}>{units.filter((unit) => true).map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.code})</option>)}</select></label>
        <label className="text-sm font-medium">Sales price<input name="defaultSalesPrice" inputMode="decimal" placeholder="0.0000" className={fieldClass} /></label>
        <label className="text-sm font-medium">Purchase price<input name="defaultPurchasePrice" inputMode="decimal" placeholder="0.0000" className={fieldClass} /></label>
        <fieldset className="text-sm font-medium"><legend>Available for</legend><div className="mt-3 flex gap-4"><label><input name="salesEnabled" type="checkbox" defaultChecked /> Sales</label><label><input name="purchaseEnabled" type="checkbox" defaultChecked /> Purchases</label></div></fieldset>
        <label className="text-sm font-medium">Sales class<select name="salesAccountClassKey" defaultValue="SALES_REVENUE" className={fieldClass}><option value="SALES_REVENUE">Sales revenue</option><option value="SERVICE_REVENUE">Service revenue</option></select></label>
        <label className="text-sm font-medium">Purchase class<select name="purchaseAccountClassKey" defaultValue="INVENTORY_PURCHASES" className={fieldClass}><option value="INVENTORY_PURCHASES">Inventory purchases</option><option value="DIRECT_EXPENSE">Direct expense</option><option value="OPERATING_EXPENSE">Operating expense</option></select></label>
        <label className="text-sm font-medium">Sales tax category<select name="defaultSalesTaxCategory" className={fieldClass}><option value="UNSPECIFIED">Unspecified</option><option value="STANDARD_RATE">Standard rate</option><option value="ZERO_RATED">Zero-rated</option><option value="EXEMPT">Exempt</option><option value="OUT_OF_SCOPE">Out of scope</option></select></label>
        <label className="text-sm font-medium">Purchase tax category<select name="defaultPurchaseTaxCategory" className={fieldClass}><option value="UNSPECIFIED">Unspecified</option><option value="STANDARD_RATE">Standard rate</option><option value="ZERO_RATED">Zero-rated</option><option value="EXEMPT">Exempt</option><option value="OUT_OF_SCOPE">Out of scope</option></select></label>
      </div>
      <label className="mt-4 block text-sm font-medium">Description<textarea name="description" rows={3} className={fieldClass} /></label>
      <button disabled={pending || units.length === 0} className="mt-4 rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white disabled:opacity-60">{pending ? "Saving…" : "Create catalog record"}</button>
    </form>

    <form onSubmit={createUnit} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <p className="text-sm font-medium text-[var(--brand)]">Units</p><h2 className="mt-1 text-xl font-semibold">Add unit of measure</h2>
      <div className="mt-5 space-y-4">
        <label className="block text-sm font-medium">Code<input name="code" required className={fieldClass} /></label>
        <label className="block text-sm font-medium">Name<input name="name" required className={fieldClass} /></label>
        <label className="block text-sm font-medium">Symbol<input name="symbol" className={fieldClass} /></label>
        <label className="block text-sm font-medium">Dimension<select name="dimension" className={fieldClass}><option value="COUNT">Count</option><option value="TIME">Time</option><option value="LENGTH">Length</option><option value="AREA">Area</option><option value="VOLUME">Volume</option><option value="MASS">Mass</option><option value="OTHER">Other</option></select></label>
        <label className="block text-sm font-medium">Quantity decimals<input name="decimalPlaces" type="number" min={0} max={6} defaultValue={2} className={fieldClass} /></label>
      </div>
      <button disabled={pending} className="mt-4 rounded-xl border border-[var(--border)] px-4 py-2.5 font-medium disabled:opacity-60">Add unit</button>
    </form>
    {message && <p className="xl:col-span-2 text-sm text-[var(--muted)]">{message}</p>}
  </div>;
}
