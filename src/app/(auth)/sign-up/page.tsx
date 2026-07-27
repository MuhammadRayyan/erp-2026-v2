import Link from "next/link";
import { AuthPanel } from "@/components/auth/auth-panel";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <AuthPanel
      eyebrow="Start clean"
      title="Create your account"
      description="Set up your owner account first. Your tenant and first business are created explicitly in the next step."
      footer={<span>Already have an account? <Link href="/sign-in" className="font-semibold text-[var(--brand)]">Sign in</Link></span>}
    >
      <SignUpForm />
    </AuthPanel>
  );
}
