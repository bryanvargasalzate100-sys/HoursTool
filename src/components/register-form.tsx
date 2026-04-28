"use client";

import { useActionState } from "react";

type RegisterState = {
  error: string | null;
  success: string | null;
};

type RegisterFormProps = {
  action: (state: RegisterState, formData: FormData) => Promise<RegisterState>;
};

const initialState: RegisterState = {
  error: null,
  success: null
};

export function RegisterForm({ action }: RegisterFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form className="form" action={formAction}>
      <div className="form-row">
        <div className="field">
          <label htmlFor="firstName">First Name</label>
          <input id="firstName" name="firstName" type="text" placeholder="Daniela" />
        </div>
        <div className="field">
          <label htmlFor="lastName">Last Name</label>
          <input id="lastName" name="lastName" type="text" placeholder="Londono" />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="phoneNumber">Phone Number</label>
          <input id="phoneNumber" name="phoneNumber" type="tel" placeholder="3001234567" />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" placeholder="name@falconfarms.com" />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" placeholder="At least 8 characters" />
          <p className="field-help">Use at least 8 characters.</p>
        </div>
        <div className="field">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input id="confirmPassword" name="confirmPassword" type="password" placeholder="Repeat your password" />
          <p className="field-help">Enter the same password again to confirm it.</p>
        </div>
      </div>

      <p className="field-help register-help">
        After creating the account, use your email and password to access the platform.
      </p>

      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.success ? <p className="form-success">{state.success}</p> : null}

      <div className="actions">
        <button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create account"}
        </button>
      </div>
    </form>
  );
}
