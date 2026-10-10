"use client";

import { Plus } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, SelectInput, TextArea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useDialogState } from "@/components/ui/use-dialog-state";
import { createApplicationAction } from "@/lib/actions/applications";
import { IDLE_STATE } from "@/lib/actions/state";
import { PIPELINE_STAGES, STAGE_LABELS } from "@/lib/constants";

type Option = { id: string; label: string };

/**
 * Creates an application, i.e. puts a candidate onto a job.
 *
 * Used from both directions: on a job page you pick a candidate, on a candidate
 * page you pick a job. The duplicate (candidate, job) pair is rejected by a
 * unique constraint in Postgres and surfaced here as a readable message.
 */
export function AssignDialog({
  mode,
  fixedId,
  options,
  triggerLabel,
  emptyMessage,
}: {
  mode: "pick-candidate" | "pick-job";
  fixedId: string;
  options: Option[];
  triggerLabel: string;
  emptyMessage: string;
}) {
  const [state, formAction] = useActionState(createApplicationAction, IDLE_STATE);
  // Closes on success. The server action revalidates the page, so the new
  // application is already in the list underneath.
  const [open, setOpen] = useDialogState(state);

  const pickingCandidate = mode === "pick-candidate";

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" />
        {triggerLabel}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={pickingCandidate ? "Add candidate to this job" : "Assign to a job"}
        description={
          pickingCandidate
            ? "This creates an application at the stage you choose."
            : "A candidate can be considered for several jobs at the same time."
        }
      >
        {options.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{emptyMessage}</p>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form action={formAction} className="space-y-4" noValidate>
            <input
              type="hidden"
              name={pickingCandidate ? "jobId" : "candidateId"}
              value={fixedId}
            />

            <FormError message={state.message} />

            <Field
              label={pickingCandidate ? "Candidate" : "Job"}
              htmlFor="assign-target"
              required
              error={
                pickingCandidate ? state.errors?.candidateId : state.errors?.jobId
              }
            >
              <SelectInput
                id="assign-target"
                name={pickingCandidate ? "candidateId" : "jobId"}
                required
                defaultValue=""
              >
                <option value="" disabled>
                  {pickingCandidate ? "Select a candidate" : "Select a job"}
                </option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field
              label="Starting stage"
              htmlFor="assign-stage"
              error={state.errors?.stage}
            >
              <SelectInput id="assign-stage" name="stage" defaultValue="new">
                {PIPELINE_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {STAGE_LABELS[stage]}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field
              label="Note"
              htmlFor="assign-notes"
              error={state.errors?.notes}
              hint="Optional. Context for the team, e.g. where this candidate came from."
            >
              <TextArea id="assign-notes" name="notes" rows={3} maxLength={5000} />
            </Field>

            <div className="flex items-center gap-2 pt-1">
              <SubmitButton pendingLabel="Adding...">Add to pipeline</SubmitButton>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
