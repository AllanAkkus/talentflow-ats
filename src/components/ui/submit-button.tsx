"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Spinner } from "@/components/ui/primitives";

/**
 * Submit button that disables itself and shows a spinner while the enclosing
 * form's server action is in flight. Using `useFormStatus` means every form
 * gets a loading state without threading `isPending` through by hand.
 */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending ? (
        <>
          <Spinner />
          {pendingLabel ?? "Saving..."}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
