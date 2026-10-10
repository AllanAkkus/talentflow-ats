"use client";

import { Plus } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, TextInput } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useDialogState } from "@/components/ui/use-dialog-state";
import { createOrganizationAction } from "@/lib/actions/organizations";
import { IDLE_STATE } from "@/lib/actions/state";

/**
 * Creates a customer organization (a tenant). Admin-only; the action
 * re-verifies the role server-side and the RLS policy requires it too.
 */
export function CreateOrganizationDialog() {
  const [state, formAction] = useActionState(
    createOrganizationAction,
    IDLE_STATE,
  );
  const [open, setOpen] = useDialogState(state);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New organization
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New organization"
        description="Each organization is an isolated tenant with its own jobs, candidates and pipeline."
        widthClassName="max-w-md"
      >
        <form action={formAction} className="space-y-4" noValidate>
          <FormError message={state.message} />
          <Field
            label="Organization name"
            htmlFor="organization-name"
            required
            error={state.errors?.name}
          >
            <TextInput
              id="organization-name"
              name="name"
              required
              maxLength={160}
              placeholder="e.g. Northstar Consulting AB"
            />
          </Field>
          <div className="flex items-center gap-2 pt-1">
            <SubmitButton pendingLabel="Creating...">Create</SubmitButton>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
