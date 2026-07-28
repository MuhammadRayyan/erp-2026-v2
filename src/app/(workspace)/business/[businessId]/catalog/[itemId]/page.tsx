import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogItemEditor } from "@/components/catalog/catalog-item-editor";
import { CustomFieldsEditor } from "@/components/custom-fields/custom-fields-editor";
import { requireBusinessPageAccess } from "@/modules/access/server/business-page";
import { hasBusinessCapability } from "@/modules/access/roles";
import { getCatalogItem, listUnits } from "@/modules/catalog/server/catalog";
import { getCustomFieldsForEntity } from "@/modules/custom-fields/server/custom-fields";

export default async function CatalogItemPage({ params }: { params: Promise<{ businessId: string; itemId: string }> }) {
  const { businessId, itemId } = await params;
  let access;
  try {
    access = await requireBusinessPageAccess(businessId, "catalog.view", "catalog.core");
  } catch {
    notFound();
  }

  let item;
  let units;
  try {
    [item, units] = await Promise.all([getCatalogItem(access.context, itemId), listUnits(access.context)]);
  } catch {
    notFound();
  }
  let customFields: Awaited<ReturnType<typeof getCustomFieldsForEntity>> = [];
  try {
    customFields = await getCustomFieldsForEntity(access.context, "CATALOG_ITEM", itemId);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "TENANT_FEATURE_DISABLED") notFound();
  }

  const canManage = hasBusinessCapability(access.context.roleKey, "catalog.manage");
  const serializedItem = {
    id: item.id,
    type: item.type,
    status: item.status,
    sku: item.sku,
    name: item.name,
    description: item.description,
    unitId: item.unitId,
    salesEnabled: item.salesEnabled,
    purchaseEnabled: item.purchaseEnabled,
    defaultSalesPrice: item.defaultSalesPrice?.toString() ?? null,
    defaultPurchasePrice: item.defaultPurchasePrice?.toString() ?? null,
    salesAccountClassKey: item.salesAccountClassKey,
    purchaseAccountClassKey: item.purchaseAccountClassKey,
    defaultSalesTaxCategory: item.defaultSalesTaxCategory,
    defaultPurchaseTaxCategory: item.defaultPurchaseTaxCategory,
  };
  const fields = customFields.map(({ definition, value }) => ({ definition: { id: definition.id, label: definition.label, description: definition.description, valueType: definition.valueType, required: definition.required, options: definition.options }, value }));

  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><Link href={`/business/${businessId}/catalog`} className="text-sm font-medium text-[var(--brand)]">← Items and services</Link><h1 className="mt-2 text-3xl font-semibold tracking-tight">{item.name}</h1><p className="mt-2 text-[var(--muted)]">{item.sku || "No SKU"} · {item.type.toLowerCase()} · {item.unit.name}</p></div>
      <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-medium text-[var(--muted)]">{item.status.toLowerCase()}</span>
    </div>
    <CatalogItemEditor businessId={businessId} item={serializedItem} units={units.map((unit) => ({ id: unit.id, code: unit.code, name: unit.name, active: unit.active }))} canManage={canManage} />
    <CustomFieldsEditor businessId={businessId} entityType="CATALOG_ITEM" entityId={itemId} fields={fields} editable={canManage} />
  </div>;
}
