import type { ReactNode } from "react";

import { signOutAction } from "@/app/auth/actions";
import { BrandLockup } from "@/components/brand-lockup";
import { StaffNav } from "@/components/staff-nav";
import { requireStaffUser } from "@/lib/auth/require-staff-user";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  await requireStaffUser();

  return (
    <main className="shell">
      <section className="workspace-header">
        <div>
          <BrandLockup
            eyebrow="Falcon Farms"
            title="FieldOps Admin"
            subtitle="Stores, codes, and hours approval"
            compact
          />
          <h1>Admin Workspace</h1>
        </div>

        <div className="actions">
          <form action={signOutAction}>
            <button className="button secondary" type="submit">
              Logout
            </button>
          </form>
        </div>
      </section>

      <section className="section">
        <StaffNav />
      </section>

      {children}
    </main>
  );
}
