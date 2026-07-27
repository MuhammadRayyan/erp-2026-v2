import { Card } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div>
      <p className="text-sm font-medium text-[var(--brand)]">Configuration</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Business settings</h1>
      <p className="mt-2 text-[var(--muted)]">Business identity, fiscal, tax, numbering, document, email, and workflow settings will be grouped here.</p>
      <Card className="mt-7">
        <dl className="grid gap-6 sm:grid-cols-2">
          <div><dt className="text-sm text-[var(--muted)]">Country</dt><dd className="mt-1 font-medium">United Arab Emirates</dd></div>
          <div><dt className="text-sm text-[var(--muted)]">Base currency</dt><dd className="mt-1 font-medium">AED</dd></div>
          <div><dt className="text-sm text-[var(--muted)]">Timezone</dt><dd className="mt-1 font-medium">Asia/Dubai</dd></div>
          <div><dt className="text-sm text-[var(--muted)]">Industry profile</dt><dd className="mt-1 font-medium">Technical Services</dd></div>
        </dl>
      </Card>
    </div>
  );
}
