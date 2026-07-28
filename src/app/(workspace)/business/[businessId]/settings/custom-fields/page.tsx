import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomFieldDefinitionsManager } from "@/components/custom-fields/custom-field-definitions-manager";
import { hasBusinessCapability } from "@/modules/access/roles";
import { requireBusinessPageAccess } from "@/modules/access/server/business-page";
import { listCustomFieldDefinitions } from "@/modules/custom-fields/server/custom-fields";

export default async function CustomFieldsSettingsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  let access;
  try {
    access = await requireBusinessPageAccess(businessId, "settings.view", "custom-fields.core");
  } catch {
    notFound();
  }
  const definitions = await listCustomFieldDefinitions(access.context);
  const serialized = definitions.map((definition) => ({
    id: definition.id,
    entityType: definition.entityType,
    key: definition.key,
    label: definition.label,
    description: definition.description,
    valueType: definition.valueType,
    required: definition.required,
    active: definition.active,
    sortOrder: definition.sortOrder,
    options: definition.options,
  }));
  return <div className="space-y-7">
    <div><Link href={`/business/${businessId}/settings`} className="text-sm font-medium text-[var(--brand)]">← Business settings</Link><p className="mt-4 text-sm font-medium text-[var(--brand)]">Flexible master data</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Custom fields</h1><p className="mt-2 max-w-3xl text-[var(--muted)]">Define typed additional fields for customers, suppliers, products, and services. Keys and value types remain immutable after creation.</p></div>
    <CustomFieldDefinitionsManager businessId={businessId} definitions={serialized} editable={hasBusinessCapability(access.context.roleKey, "settings.manage")} />
  </div>;
}
