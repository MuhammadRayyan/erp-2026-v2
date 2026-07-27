import Link from "next/link";
import { AuthPanel } from "@/components/auth/auth-panel";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthPanel
      eyebrow="Welcome back"
      title="Sign in to your account"
      description="Open your businesses, continue daily work, and keep every transaction connected to the correct books."
      footer={<span>New here? <Link href="/sign-up" className="font-semibold text-[var(--brand)]">Create an account</Link></span>}
    >
      <SignInForm />
    </AuthPanel>
  );
}
