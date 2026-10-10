"use client";

import { LogIn } from "lucide-react";
import { useActionState } from "react";

import { loginAction, type LoginState } from "@/app/login/actions";
import { Field, FormError, TextInput } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

const INITIAL: LoginState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(loginAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <FormError message={state.formError} />

      <Field
        label="Work email"
        htmlFor="email"
        required
        error={state.errors?.email}
      >
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="you@company.com"
          defaultValue={state.values?.email ?? ""}
          invalid={Boolean(state.errors?.email)}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        required
        error={state.errors?.password}
      >
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••••"
          invalid={Boolean(state.errors?.password)}
        />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Signing in...">
        <LogIn className="size-4" />
        Sign in
      </SubmitButton>
    </form>
  );
}
