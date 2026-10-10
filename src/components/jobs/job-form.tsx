"use client";

import { useActionState } from "react";

import { LinkButton } from "@/components/ui/button";
import {
  Field,
  FormError,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { createJobAction, updateJobAction } from "@/lib/actions/jobs";
import { IDLE_STATE } from "@/lib/actions/state";
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  JOB_STATUSES,
  JOB_STATUS_LABELS,
} from "@/lib/constants";
import type { Job } from "@/types/database";

/**
 * Create/edit form for a job. The same component backs both routes - when a
 * `job` is passed it edits, otherwise it creates. Validation messages come back
 * from the server action, which runs the same Zod schema the API would.
 */
export function JobForm({ job }: { job?: Job }) {
  const [state, formAction] = useActionState(
    job ? updateJobAction : createJobAction,
    IDLE_STATE,
  );

  const value = (field: string, fallback: string | null | undefined) =>
    state.values?.[field] ?? fallback ?? "";

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {job ? <input type="hidden" name="jobId" value={job.id} /> : null}

      <FormError message={state.message} />

      <Field label="Job title" htmlFor="title" required error={state.errors?.title}>
        <TextInput
          id="title"
          name="title"
          required
          autoFocus
          maxLength={160}
          placeholder="e.g. Backend Developer"
          defaultValue={value("title", job?.title)}
          invalid={Boolean(state.errors?.title)}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Status"
          htmlFor="status"
          required
          error={state.errors?.status}
          hint="Draft jobs are hidden from reporting until you open them."
        >
          <SelectInput
            id="status"
            name="status"
            defaultValue={value("status", job?.status ?? "open")}
            invalid={Boolean(state.errors?.status)}
          >
            {JOB_STATUSES.map((status) => (
              <option key={status} value={status}>
                {JOB_STATUS_LABELS[status]}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field
          label="Employment type"
          htmlFor="employmentType"
          error={state.errors?.employmentType}
        >
          <SelectInput
            id="employmentType"
            name="employmentType"
            defaultValue={value("employmentType", job?.employment_type)}
            invalid={Boolean(state.errors?.employmentType)}
          >
            <option value="">Not specified</option>
            {EMPLOYMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {EMPLOYMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <Field label="Location" htmlFor="location" error={state.errors?.location}>
        <TextInput
          id="location"
          name="location"
          maxLength={160}
          placeholder="e.g. Stockholm (hybrid)"
          defaultValue={value("location", job?.location)}
          invalid={Boolean(state.errors?.location)}
        />
      </Field>

      <Field
        label="Description"
        htmlFor="description"
        error={state.errors?.description}
        hint="Requirements and responsibilities. This text is what AI Match Analysis compares a CV against."
      >
        <TextArea
          id="description"
          name="description"
          rows={10}
          placeholder="What does this role need? Tech stack, seniority, responsibilities..."
          defaultValue={value("description", job?.description)}
          invalid={Boolean(state.errors?.description)}
        />
      </Field>

      <div className="flex items-center gap-2 border-t border-slate-200 pt-4">
        <SubmitButton pendingLabel={job ? "Saving..." : "Creating..."}>
          {job ? "Save changes" : "Create job"}
        </SubmitButton>
        <LinkButton href={job ? `/jobs/${job.id}` : "/jobs"}>Cancel</LinkButton>
      </div>
    </form>
  );
}
