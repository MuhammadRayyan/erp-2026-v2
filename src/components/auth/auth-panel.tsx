import Link from "next/link";

export function AuthPanel({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
      <section className="hidden border-r border-[var(--border)] bg-[var(--brand-strong)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight">ERP 2026</Link>
        <div className="max-w-xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/65">Structured from day one</p>
          <h2 className="mt-4 text-5xl font-semibold leading-tight tracking-tight">Run the work. Keep the books correct.</h2>
          <p className="mt-5 text-lg leading-8 text-white/75">A practical UAE-first ERP for services, workshops, projects, trading, accounting, and everyday business control.</p>
        </div>
        <p className="text-sm text-white/55">Local-first · Docker-ready · Modular accounting core</p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow)] sm:p-9">
          <p className="text-sm font-semibold text-[var(--brand)]">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{description}</p>
          <div className="mt-7">{children}</div>
          <div className="mt-6 border-t border-[var(--border)] pt-5 text-sm text-[var(--muted)]">{footer}</div>
        </div>
      </section>
    </main>
  );
}
