"use client";

import { useActionState } from "react";

import { cn } from "@/lib/utils";

type LoginState = {
  error: string | null;
};

type LoginFormProps = {
  action: (state: LoginState, formData: FormData) => Promise<LoginState>;
  className?: string;
  fields: Array<{
    id: string;
    name: string;
    label: string;
    type: string;
    placeholder?: string;
  }>;
  submitLabel: string;
};

const initialState: LoginState = {
  error: null
};

export function LoginForm({ action, className, fields, submitLabel }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form className={cn("form", className)} action={formAction}>
      {fields.map((field) => (
        <div className="field" key={field.id}>
          <label htmlFor={field.id}>{field.label}</label>
          <input
            id={field.id}
            name={field.name}
            type={field.type}
            placeholder={field.placeholder}
          />
        </div>
      ))}

      {state.error ? <p className="form-error">{state.error}</p> : null}

      <div className="actions">
        <button type="submit" disabled={isPending}>
          {isPending ? "Checking..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
