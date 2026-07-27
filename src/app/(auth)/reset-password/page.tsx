import Link from "next/link";
import { AuthPanel } from "@/components/auth/auth-panel";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const query = await searchParams;
  const token = query.error ? null : query.token ?? null;

  return (
    <AuthPanel
      eyebrow="Account recovery"
      title="Choose a new password"
      description="Reset links expire after one hour. Completing the reset revokes other active sessions for this account."
      footer={<Link href="/sign-in" className="font-semibold text-[var(--brand)]">Return to sign in</Link>}
    >
      <ResetPasswordForm token={token} />
    </AuthPanel>
  );
}
