import { BrandLockup } from "@/components/brand-lockup";
import { LoginForm } from "@/components/login-form";

import { signInStaffAction } from "@/app/login/actions";

type StaffLoginPageProps = {
  searchParams?: Promise<{
    reason?: string;
  }>;
};

export default async function StaffLoginPage({ searchParams }: StaffLoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const sessionMessage =
    resolvedSearchParams?.reason === "expired"
      ? "Your session expired. Please sign in again."
      : resolvedSearchParams?.reason === "forbidden"
        ? "This account does not have access to the staff workspace."
        : null;

  return (
    <main className="shell">
      <section className="hero compact-hero">
        <BrandLockup
          eyebrow="Falcon Farms"
          title="FieldOps Admin"
          subtitle="Secure staffing access"
        />
        <h1>Staff Login</h1>
        <p>Sign in with your staff email and password to review, approve, or reject submitted hours.</p>
      </section>

      <section className="card section narrow-panel">
        <h2 className="section-title">Admin Access</h2>
        {sessionMessage ? <p className="form-error">{sessionMessage}</p> : null}
        <LoginForm
          action={signInStaffAction}
          fields={[
            {
              id: "email",
              name: "email",
              label: "Email",
              type: "email",
              placeholder: "staff@company.com"
            },
            {
              id: "password",
              name: "password",
              label: "Password",
              type: "password"
            }
          ]}
          submitLabel="Sign in"
        />
      </section>
    </main>
  );
}
