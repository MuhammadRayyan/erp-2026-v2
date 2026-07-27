import { Building2, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export const metadata = { title: "Create business" };

export default function NewBusinessPage() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <p className="text-sm font-semibold text-[var(--brand)]">Business onboarding</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Create your business workspace</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">This creates the legal business boundary, owner access, base currency, and localization defaults. Accounting and VAT setup follows in a controlled checklist.</p>
        <Card className="mt-7 p-6 sm:p-8">
          <OnboardingForm />
        </Card>
      </div>
      <aside className="space-y-4">
        <Card>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--brand)]"><Building2 size={21} /></div>
          <h2 className="mt-4 font-semibold">What happens next</h2>
          <ul className="mt-4 space-y-3 text-sm text-[var(--muted)]">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-[var(--brand)]" size={16} /> Open your business dashboard.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-[var(--brand)]" size={16} /> Complete legal identity and UAE VAT settings.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-[var(--brand)]" size={16} /> Select an industry profile and chart foundation.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-[var(--brand)]" size={16} /> Invite users only when you are ready.</li>
          </ul>
        </Card>
        <p className="px-2 text-xs leading-5 text-[var(--muted)]">Creation is idempotent: retrying a timed-out request will not create duplicate tenants or businesses.</p>
      </aside>
    </div>
  );
}
