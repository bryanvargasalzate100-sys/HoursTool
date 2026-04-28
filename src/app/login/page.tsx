import Link from "next/link";
import type { Route } from "next";

import { LoginForm } from "@/components/login-form";

import { signInMchAction } from "./actions";

export default function LoginPage() {
  return (
    <main className="shell">
      <section className="hero compact-hero">
        <p className="eyebrow">FieldOps</p>
        <h1>Team Login</h1>
        <p>Use your email and password to access the platform.</p>
      </section>

      <section className="card section narrow-panel feature-card">
        <p className="eyebrow">Daily Access</p>
        <h2 className="section-title">Sign in</h2>
        <p className="section-copy">
          Continue your schedule, log visits for today, and track approval status from one place.
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
        <p className="admin-link-copy">
          Need an account? <Link href={"/register" as Route}>Register here</Link>
        </p>
        <p className="admin-link-copy">
          Admin or staffing team? <Link href="/staff/login">Sign in here</Link>
        </p>
      </section>
    </main>
  );
}
