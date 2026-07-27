import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { requireBusinessPageCapability } from "@/modules/access/server/business-page";

export default async function SettingsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;

  let access;
  try {
    access = await requireBusinessPageCapability(businessId, "settings.view");
  } catch {
    notFound();
  }

  const business = await db.business.findUnique({
    where: {
      tenantId_id: {
        tenantId: access.context.tenantId,
        id: businessId,
      },
    },
    select: {
      legalName: true,
      tradingName: true,
      countryCode: true,
      baseCurrency: true,
      timezone: true,
    },
  });

  if (!business) {
    notFound();
  }

  return (
    <div>
      <p className="text-sm font-medium text-[var(--brand)]">Configuration</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Business settings</h1>
      <p className="mt-2 text-[var(--muted)]">Business identity, fiscal, tax, numbering, document, email, and workflow settings are managed here.</p>
      <Card className="mt-7">
        <dl className="grid gap-6 sm:grid-cols-2">
          <div><dt className="text-sm text-[var(--muted)]">Legal name</dt><dd className="mt-1 font-medium">{business.legalName}</dd></div>
          <div><dt className="text-sm text-[var(--muted)]">Trading name</dt><dd className="mt-1 font-medium">{business.tradingName || "Not set"}</dd></div>
          <div><dt className="text-sm text-[var(--muted)]">Country</dt><dd className="mt-1 font-medium">{business.countryCode}</dd></div>
          <div><dt className="text-sm text-[var(--muted)]">Base currency</dt><dd className="mt-1 font-medium">{business.baseCurrency}</dd></div>
          <div><dt className="text-sm text-[var(--muted)]">Timezone</dt><dd className="mt-1 font-medium">{business.timezone}</dd></div>
          <div><dt className="text-sm text-[var(--muted)]">Industry profile</dt><dd className="mt-1 font-medium">Not selected</dd></div>
        </dl>
      </Card>
    </div>
  );
}
