import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { BusinessProfileForm } from "@/components/business-settings/business-profile-form";
import { hasBusinessCapability } from "@/modules/access/roles";
import { requireBusinessPageAccess } from "@/modules/access/server/business-page";
import { getBusinessProfile } from "@/modules/business-settings/server/business-profile";

export default async function SettingsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;

  let access;
  try {
    access = await requireBusinessPageAccess(businessId, "settings.view", "core.settings");
  } catch {
    notFound();
  }

  const business = await getBusinessProfile(access.context);
  const profile = business.profile;

  if (!profile) {
    notFound();
  }

  return (
    <div>
      <p className="text-sm font-medium text-[var(--brand)]">Configuration</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Business settings</h1>
      <p className="mt-2 text-[var(--muted)]">Manage the business identity, localization, industry defaults, UAE VAT status, and fiscal foundation.</p>

      <Card className="mt-7">
        <div className="mb-7 border-b border-[var(--border)] pb-6">
          <h2 className="text-lg font-semibold">Workspace identity</h2>
          <dl className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <div><dt className="text-sm text-[var(--muted)]">Legal name</dt><dd className="mt-1 font-medium">{business.legalName}</dd></div>
            <div><dt className="text-sm text-[var(--muted)]">Trading name</dt><dd className="mt-1 font-medium">{business.tradingName || "Not set"}</dd></div>
            <div><dt className="text-sm text-[var(--muted)]">Base currency</dt><dd className="mt-1 font-medium">{business.baseCurrency}</dd></div>
            <div><dt className="text-sm text-[var(--muted)]">Timezone</dt><dd className="mt-1 font-medium">{business.timezone}</dd></div>
          </dl>
        </div>

        <BusinessProfileForm
          businessId={business.id}
          editable={hasBusinessCapability(access.context.roleKey, "settings.manage")}
          initial={{
            industryProfile: profile.industryProfile,
            legalForm: profile.legalForm,
            tradeLicenseNumber: profile.tradeLicenseNumber,
            tradeLicenseAuthority: profile.tradeLicenseAuthority,
            vatRegistrationStatus: profile.vatRegistrationStatus,
            trn: profile.trn,
            vatEffectiveFrom: profile.vatEffectiveFrom?.toISOString().slice(0, 10) ?? null,
            fiscalYearStartMonth: profile.fiscalYearStartMonth,
            documentLanguage: profile.documentLanguage,
          }}
        />
      </Card>
    </div>
  );
}
