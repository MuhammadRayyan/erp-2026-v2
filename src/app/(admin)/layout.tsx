import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#111418] text-[#f4f6f8]">
      <header className="border-b border-white/10 px-6 py-4"><div className="mx-auto flex max-w-6xl justify-between"><strong>ERP Platform</strong><Link href="/businesses" className="text-sm text-white/70">Return to account</Link></div></header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
