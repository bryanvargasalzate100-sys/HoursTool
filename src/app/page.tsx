import Link from "next/link";
import type { Route } from "next";

import { BrandLockup } from "@/components/brand-lockup";
import { LoginForm } from "@/components/login-form";

import { signInMchAction } from "./login/actions";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="brand-hero">
        <div className="brand-copy">
          <BrandLockup
            eyebrow="Falcon Farms"
            title="FieldOps"
            subtitle="Field activity platform"
          />
          <h1>Visit tracking for field teams.</h1>
          <p className="hero-copy">
            Register yourself or sign in with your email to log store visits and working hours.
          </p>
          <div className="hero-stat-grid">
            <article className="hero-stat-card">
              <strong>Self-serve access</strong>
              <span>Create an account and start logging visits without waiting for staff setup.</span>
            </article>
            <article className="hero-stat-card">
              <strong>Fast approvals</strong>
              <span>Hours move into the admin approval queue and export pipeline in one workflow.</span>
            </article>
          </div>
        </div>

        <article className="card login-card feature-card">
          <p className="eyebrow">Crew Access</p>
          <h2 className="section-title">Team Login</h2>
          <p className="section-copy">
            Sign in with your work email to continue your field log, check status, or add today&apos;s hours.
          </p>
          <LoginForm
            action={signInMchAction}
            fields={[
              {
                id: "email",
                name: "email",
                label: "Email",
                type: "email",
                placeholder: "name@company.com"
              },
              {
                id: "password",
                name: "password",
                label: "Password",
                type: "password",
                placeholder: "••••••••"
              }
            ]}
            submitLabel="Sign in"
          />
          <p className="admin-link-copy brand-muted">
            Need an account? <Link href={"/register" as Route}>Create it here</Link>
          </p>
          <p className="admin-link-copy brand-muted">
            Admin or staffing team? <Link href="/staff/login">Sign in here</Link>
          </p>
        </article>
      </section>
    </main>
  );
}
