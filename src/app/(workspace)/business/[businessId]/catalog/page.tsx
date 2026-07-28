import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { CatalogCreateForms } from "@/components/catalog/catalog-create-forms";
import { UnitStatusButton } from "@/components/catalog/unit-status-button";
import { requireBusinessPageAccess } from "@/modules/access/server/business-page";
import { hasBusinessCapability } from "@/modules/access/roles";
import { listCatalogItems, listUnits } from "@/modules/catalog/server/catalog";

function price(value: { toString(): string } | null) {
  return value ? value.toString() : "—";
}

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ q?: string; type?: string; status?: string }>;
}) {
  const { businessId } = await params;
  const filters = await searchParams;
  let access;
  try {
    access = await requireBusinessPageAccess(businessId, "catalog.view", "catalog.core");
  } catch {
    notFound();
  }

  const type = filters.type === "PRODUCT" || filters.type === "SERVICE" ? filters.type : undefined;
  const status = filters.status === "ACTIVE" || filters.status === "INACTIVE" ? filters.status : undefined;
  const [items, units] = await Promise.all([
    listCatalogItems(access.context, { query: filters.q, type, status }),
    listUnits(access.context),
  ]);
  const canManage = hasBusinessCapability(access.context.roleKey, "catalog.manage");

  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[var(--brand)]">Shared master data</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Items and services</h1>
        <p className="mt-2 max-w-3xl text-[var(--muted)]">Reusable products, services, units, exact default prices, and preparatory account and tax classifications.</p>
      </div>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={filters.q} placeholder="Search SKU, name, or description" className="min-w-72 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5" />
        <select name="type" defaultValue={filters.type ?? ""} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"><option value="">All types</option><option value="PRODUCT">Products</option><option value="SERVICE">Services</option></select>
        <select name="status" defaultValue={filters.status ?? ""} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
        <button className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-medium">Filter</button>
      </form>
    </div>

    {canManage && <CatalogCreateForms businessId={businessId} units={units.filter((unit) => unit.active).map((unit) => ({ id: unit.id, code: unit.code, name: unit.name, symbol: unit.symbol, dimension: unit.dimension, decimalPlaces: unit.decimalPlaces }))} />}

    <section>
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Catalog register</h2><span className="text-sm text-[var(--muted)]">{items.length} records · {units.length} units</span></div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {items.length === 0 ? <div className="p-10 text-center text-sm text-[var(--muted)]">No matching products or services yet.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-[var(--muted)]"><tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3">Sales price</th><th className="px-4 py-3">Purchase price</th><th className="px-4 py-3">Tax defaults</th><th className="px-4 py-3">Status</th></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">{items.map((item) => <tr key={item.id}>
            <td className="px-4 py-4"><Link href={`/business/${businessId}/catalog/${item.id}`} className="font-medium text-[var(--brand)] hover:underline">{item.name}</Link><p className="text-xs text-[var(--muted)]">{item.sku || "No SKU"} · {item.salesAccountClassKey} / {item.purchaseAccountClassKey}</p></td>
            <td className="px-4 py-4">{item.type.toLowerCase()}</td>
            <td className="px-4 py-4">{item.unit.name} ({item.unit.code})</td>
            <td className="px-4 py-4 font-mono">{price(item.defaultSalesPrice)}</td>
            <td className="px-4 py-4 font-mono">{price(item.defaultPurchasePrice)}</td>
            <td className="px-4 py-4"><p>{item.defaultSalesTaxCategory.toLowerCase()}</p><p className="text-xs text-[var(--muted)]">Purchase: {item.defaultPurchaseTaxCategory.toLowerCase()}</p></td>
            <td className="px-4 py-4"><span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs">{item.status.toLowerCase()}</span></td>
          </tr>)}</tbody>
        </table></div>}
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-3">{units.map((unit) => <Card key={unit.id}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{unit.name}</h3><p className="mt-1 text-sm text-[var(--muted)]">{unit.code}{unit.symbol ? ` · ${unit.symbol}` : ""}</p></div><span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs">{unit.active ? unit.dimension.toLowerCase() : "inactive"}</span></div><p className="mt-4 text-sm text-[var(--muted)]">Allows {unit.decimalPlaces} quantity decimal places.</p>{canManage && <UnitStatusButton businessId={businessId} unitId={unit.id} active={unit.active} />}</Card>)}</section>
  </div>;
}
