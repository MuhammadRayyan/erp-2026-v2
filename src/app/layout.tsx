import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ERP 2026", template: "%s | ERP 2026" },
  description: "A structured UAE-first ERP for practical small-business workflows.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
