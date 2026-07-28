import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogImportWorkbench } from "@/components/catalog/catalog-import-workbench";
import { requireBusinessPageAccess } from "@/modules/access/server/business-page";
import { hasBusinessCapability } from "@/modules/access/roles";

export default async function CatalogImportsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  let access;
  try {
    access = await requireBusinessPageAccess(businessId, "catalog.view", "catalog.core");
  } catch {
    notFound();
  }
  if (!hasBusinessCapability(access.context.roleKey, "catalog.manage")) notFound();

  return <div className="space-y-8">
    <div><Link href={`/business/${businessId}/catalog`} className="text-sm font-medium text-[var(--brand)]">← Items and services</Link><h1 className="mt-2 text-3xl font-semibold tracking-tight">Catalog import</h1><p className="mt-2 max-w-3xl text-[var(--muted)]">Preview and resolve CSV rows before one tenant-scoped transaction creates or updates catalog records.</p></div>
    <CatalogImportWorkbench businessId={businessId} />
  </div>;
}
