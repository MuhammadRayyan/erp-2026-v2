import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PartyCreateForm } from "@/components/parties/party-create-form";
import { requireBusinessPageAccess } from "@/modules/access/server/business-page";
import { hasBusinessCapability } from "@/modules/access/roles";
import { listParties } from "@/modules/parties/server/parties";

export default async function PartiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const { businessId } = await params;
  const filters = await searchParams;
  let access;
  try {
    access = await requireBusinessPageAccess(businessId, "parties.view", "parties.core");
  } catch {
    notFound();
  }

  const parties = await listParties(access.context, {
    query: filters.q,
    role: filters.role === "CUSTOMER" || filters.role === "SUPPLIER" ? filters.role : undefined,
  });
  const canManage = hasBusinessCapability(access.context.roleKey, "parties.manage");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--brand)]">Shared master data</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Customers and suppliers</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">One party can be a customer, supplier, or both, with reusable contacts, addresses, and tax identity.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/business/${businessId}/parties/duplicates`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-medium">Review duplicates</Link>
          <form className="flex flex-wrap gap-2">
            <input name="q" defaultValue={filters.q} placeholder="Search name, email, phone, or TRN" className="min-w-72 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5" />
            <select name="role" defaultValue={filters.role ?? ""} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"><option value="">All roles</option><option value="CUSTOMER">Customers</option><option value="SUPPLIER">Suppliers</option></select>
            <button className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-medium">Filter</button>
          </form>
        </div>
      </div>

      {canManage && <PartyCreateForm businessId={businessId} />}

      <section>
        <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Party register</h2><span className="text-sm text-[var(--muted)]">{parties.length} records</span></div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {parties.length === 0 ? (
            <Card className="col-span-full border-dashed p-10 text-center text-sm text-[var(--muted)]">No matching parties yet.</Card>
          ) : parties.map((party) => (
            <Link key={party.id} href={`/business/${businessId}/parties/${party.id}`} className="block rounded-2xl outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[var(--brand)]">
              <Card className="h-full transition hover:-translate-y-0.5 hover:border-[var(--brand)]">
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="font-semibold">{party.displayName}</h3><p className="mt-1 text-sm text-[var(--muted)]">{party.type === "ORGANIZATION" ? "Organization" : "Individual"}</p></div>
                  <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--muted)]">{party.status.toLowerCase()}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">{party.roles.map(({ role }) => <span key={role} className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-xs font-medium text-[var(--brand)]">{role.toLowerCase()}</span>)}</div>
                <dl className="mt-5 space-y-2 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-[var(--muted)]">Email</dt><dd className="truncate">{party.email || party.contacts[0]?.email || "—"}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-[var(--muted)]">Phone</dt><dd>{party.phone || party.contacts[0]?.phone || "—"}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-[var(--muted)]">Location</dt><dd>{party.addresses[0]?.emirate || party.addresses[0]?.city || "—"}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-[var(--muted)]">TRN</dt><dd>{party.taxRegistrationNumber || "—"}</dd></div>
                </dl>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
