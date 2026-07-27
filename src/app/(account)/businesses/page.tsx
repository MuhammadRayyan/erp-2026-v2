import Link from "next/link";
import { headers } from "next/headers";
import { Building2, Plus, Users } from "lucide-react";
import { MembershipStatus, TenantStatus } from "@/generated/prisma/client";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requireRequestSession } from "@/modules/identity/server/session";

export default async function BusinessesPage() {
  const session = await requireRequestSession(await headers());
  const memberships = await db.businessMembership.findMany({
    where: {
      userId: session.user.id,
      status: MembershipStatus.ACTIVE,
      tenantUser: { status: MembershipStatus.ACTIVE },
      business: { tenant: { status: TenantStatus.ACTIVE } },
    },
    orderBy: { business: { legalName: "asc" } },
    select: {
      tenantId: true,
      roleKey: true,
      tenantUser: { select: { isOwner: true } },
      business: {
        select: {
          id: true,
          legalName: true,
          tradingName: true,
          countryCode: true,
          baseCurrency: true,
          tenant: { select: { name: true } },
        },
      },
    },
  });

  const ownedTenants = Array.from(
    new Map(
      memberships
        .filter((membership) => membership.tenantUser.isOwner)
        .map((membership) => [membership.tenantId, membership.business.tenant.name]),
    ),
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--brand)]">Account Hub</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your businesses</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">Open a workspace or create another legal entity when your plan allows it.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ownedTenants.map(([tenantId, tenantName]) => (
            <Link key={tenantId} href={`/tenants/${tenantId}/users`} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-medium transition hover:border-[var(--brand)]">
              <Users size={18} /> Manage {tenantName}
            </Link>
          ))}
          <Link href="/businesses/new" className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white transition hover:bg-[var(--brand-strong)]">
            <Plus size={18} /> New business
          </Link>
        </div>
      </div>

      {memberships.length === 0 ? (
        <Card className="mt-8 border-dashed p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--brand)]"><Building2 size={24} /></div>
          <h2 className="mt-5 text-xl font-semibold">Create your first business</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">Your account is ready. Create a business to establish the accounting, user-access, and operational boundary.</p>
          <Link href="/businesses/new" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white">Start business setup <span aria-hidden>→</span></Link>
        </Card>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {memberships.map(({ business, roleKey }) => (
            <Link key={business.id} href={`/business/${business.id}/dashboard`}>
              <Card className="h-full transition hover:-translate-y-0.5 hover:border-[var(--brand)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--brand)]"><Building2 size={22} /></div>
                  <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--muted)]">{roleKey.replace("business.", "")}</span>
                </div>
                <h2 className="mt-5 text-xl font-semibold">{business.tradingName || business.legalName}</h2>
                {business.tradingName && <p className="mt-1 text-sm text-[var(--muted)]">{business.legalName}</p>}
                <p className="mt-2 text-sm text-[var(--muted)]">{business.tenant.name} · {business.countryCode}</p>
                <div className="mt-5 flex justify-between text-sm"><span>{business.baseCurrency} base currency</span><span className="text-[var(--brand)]">Open →</span></div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
