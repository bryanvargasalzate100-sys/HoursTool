"use client";

import { useActionState } from "react";

import { updateAgencyAction } from "@/app/(staff)/staff/agencies/actions";

type AgencyFormState = {
  error: string | null;
  success: string | null;
};

const initialState: AgencyFormState = {
  error: null,
  success: null
};

type StaffAgencyRowFormProps = {
  agency: {
    id: string;
    name: string;
    charge: number | null;
  };
};

export function StaffAgencyRowForm({ agency }: StaffAgencyRowFormProps) {
  const [state, formAction, isPending] = useActionState(updateAgencyAction, initialState);

  return (
    <tr>
      <td colSpan={3}>
        <form className="agency-row-form" action={formAction}>
          <input name="agencyId" type="hidden" value={agency.id} />

          <div className="agency-row-grid">
            <input
              className="table-input"
              name="name"
              type="text"
              defaultValue={agency.name}
            />

            <div className="table-field-inline">
              <input
                className="table-input"
                name="charge"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={Number(agency.charge ?? 0).toFixed(2)}
              />
              <span>%</span>
            </div>

            <button className="button secondary table-action" type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </button>
          </div>

          {state.error ? <p className="form-error agency-row-message">{state.error}</p> : null}
          {state.success ? <p className="form-success agency-row-message">{state.success}</p> : null}
        </form>
      </td>
    </tr>
  );
}
