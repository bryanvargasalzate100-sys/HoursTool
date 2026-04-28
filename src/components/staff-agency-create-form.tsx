"use client";

import { useActionState, useEffect, useRef } from "react";

import { createAgencyAction } from "@/app/(staff)/staff/agencies/actions";

type AgencyFormState = {
  error: string | null;
  success: string | null;
};

const initialState: AgencyFormState = {
  error: null,
  success: null
};

export function StaffAgencyCreateForm() {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, formAction, isPending] = useActionState(createAgencyAction, initialState);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} className="form" action={formAction}>
      <div className="form-row">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" placeholder="North Agency" />
        </div>
        <div className="field">
          <label htmlFor="charge">Charge (%)</label>
          <input id="charge" name="charge" type="number" min="0" max="100" step="0.01" placeholder="12.50" />
        </div>
      </div>

      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.success ? <p className="form-success">{state.success}</p> : null}

      <div className="actions">
        <button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save agency"}
        </button>
      </div>
    </form>
  );
}
