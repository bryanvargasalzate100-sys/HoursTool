import Link from "next/link";

import { BrandLockup } from "@/components/brand-lockup";
import { RegisterForm } from "@/components/register-form";

import { registerMchAction } from "@/app/login/actions";

export default function RegisterPage() {
  return (
    <main className="shell">
      <section className="hero compact-hero">
        <BrandLockup
          eyebrow="Falcon Farms"
          title="FieldOps"
          subtitle="Self-service registration"
        />
        <h1>Create your account</h1>
        <p>Register yourself to start logging your hours and store visits.</p>
        <p>
          You only need your personal details, your email, and a password with at least 8
          characters. Your email will be the account key you use to sign in.
        </p>
      </section>

      <section className="card section narrow-panel feature-card">
        <p className="eyebrow">Start Here</p>
        <h2 className="section-title">Register</h2>
        <p className="section-copy">
          Create your account once, receive your assigned ID automatically, and enter the visit log workflow immediately.
        </p>
        <RegisterForm action={registerMchAction} />
        <p className="admin-link-copy">
          Already have an account? <Link href="/login">Sign in here</Link>
        </p>
      </section>
    </main>
  );
}
