"use client";

import { useActionState, useEffect, useState } from "react";

import { SearchableSelect } from "@/components/searchable-select";

type StaffUserFormState = {
  error: string | null;
  success: string | null;
  generatedPassword: string | null;
};

type StaffUserFormProps = {
  action: (state: StaffUserFormState, formData: FormData) => Promise<StaffUserFormState>;
  availableCodes: Array<{
    id: string;
    staffing_code: string;
  }>;
  agencies: Array<{
    id: string;
    name: string;
  }>;
};

const initialState: StaffUserFormState = {
  error: null,
  success: null,
  generatedPassword: null
};

type StoreOption = {
  id: string;
  name: string;
  customer: string | null;
};

export function StaffUserForm({ action, availableCodes, agencies }: StaffUserFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [storesLoading, setStoresLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function warmStoresSearch() {
      try {
        const response = await fetch("/api/staff/stores-options", {
          method: "GET",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Could not load stores.");
        }

        if (!cancelled) {
          setStoresLoading(false);
        }
      } catch {
        if (!cancelled) {
          setStoresLoading(false);
        }
      }
    }

    warmStoresSearch();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <form className="form" action={formAction}>
      <div className="form-row">
        <div className="field">
          <label htmlFor="staffingCode">ID</label>
          <select id="staffingCode" name="staffingCode" defaultValue="">
            <option value="" disabled>
              Select an available code
            </option>
            {availableCodes.map((code) => (
              <option key={code.id} value={code.staffing_code}>
                {code.staffing_code}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="firstName">First Name</label>
          <input id="firstName" name="firstName" type="text" />
        </div>
        <div className="field">
          <label htmlFor="lastName">Last Name</label>
          <input id="lastName" name="lastName" type="text" />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="phoneNumber">Phone Number</label>
          <input id="phoneNumber" name="phoneNumber" type="tel" />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" />
        </div>
        <div className="field">
          <label htmlFor="hourlyRate">Rate</label>
          <input id="hourlyRate" name="hourlyRate" type="number" step="0.01" />
        </div>
      </div>

      <div className="form-row">
        <SearchableSelect
          id="storeId"
          name="storeId"
          label="Store"
          placeholder={storesLoading ? "Loading stores..." : "Start typing to find a store"}
          loadOptions={async (query) => {
            const params = new URLSearchParams();

            if (query.trim()) {
              params.set("q", query.trim());
            }

            const response = await fetch(`/api/staff/stores-options?${params.toString()}`, {
              method: "GET",
              cache: "no-store"
            });

            if (!response.ok) {
              throw new Error("Could not load stores.");
            }

            const data = (await response.json()) as StoreOption[];

            return data.map((store) => ({
              id: store.id,
              label: store.name,
              description: store.customer
            }));
          }}
          disabled={storesLoading}
        />
        <div className="field">
          <label htmlFor="agencyId">Agency</label>
          <select id="agencyId" name="agencyId">
            {agencies.map((agency) => (
              <option key={agency.id} value={agency.id}>
                {agency.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.error ? <p className="form-error">{state.error}</p> : null}

      {state.success ? (
        <div className="form-success">
          <p>{state.success}</p>
          {state.generatedPassword ? (
            <p>
              Initial password: <code>{state.generatedPassword}</code>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="actions">
        <button
          type="submit"
          disabled={
            isPending ||
            availableCodes.length === 0 ||
            agencies.length === 0 ||
            storesLoading
          }
        >
          {isPending ? "Creating..." : "Create MCH user"}
        </button>
      </div>
    </form>
  );
}
