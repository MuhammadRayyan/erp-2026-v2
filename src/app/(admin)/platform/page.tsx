const areas = ["Tenants", "Plans & entitlements", "Background jobs", "Email & storage", "Backups", "Platform audit"];

export default function PlatformPage() {
  return (
    <div>
      <p className="text-sm font-medium text-emerald-300">Operator workspace</p>
      <h1 className="mt-1 text-3xl font-semibold">Platform administration</h1>
      <p className="mt-2 max-w-2xl text-white/60">This area is intentionally separated from tenant and business workspaces.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {areas.map((area) => <section key={area} className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold">{area}</h2><p className="mt-2 text-sm text-white/55">Planned foundation module.</p></section>)}
      </div>
    </div>
  );
}
