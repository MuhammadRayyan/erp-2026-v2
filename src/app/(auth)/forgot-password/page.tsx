import Link from "next/link";
import { AuthPanel } from "@/components/auth/auth-panel";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthPanel
      eyebrow="Account recovery"
      title="Reset your password"
      description="Enter your account email. For privacy, the response is the same whether or not an account exists."
      footer={<Link href="/sign-in" className="font-semibold text-[var(--brand)]">Return to sign in</Link>}
    >
      <ForgotPasswordForm />
    </AuthPanel>
  );
}
