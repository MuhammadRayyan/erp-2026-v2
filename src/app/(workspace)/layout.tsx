import { BusinessShell } from "@/components/layout/business-shell";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <BusinessShell>{children}</BusinessShell>;
}
