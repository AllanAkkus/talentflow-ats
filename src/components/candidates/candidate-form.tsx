"use client";

import { useActionState } from "react";

import { LinkButton } from "@/components/ui/button";
import { Field, FormError, TextArea, TextInput } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  createCandidateAction,
  updateCandidateAction,
} from "@/lib/actions/candidates";
import { IDLE_STATE } from "@/lib/actions/state";
import type { Candidate } from "@/types/database";

/**
 * Create/edit form for a candidate.
 *
 * CV text is a plain textarea for the MVP: pasting a CV takes two seconds and
 * is reliable, whereas PDF parsing is a whole sub-project. See ASSUMPTIONS.md.
 */
export function CandidateForm({ candidate }: { candidate?: Candidate }) {
  const [state, formAction] = useActionState(
    candidate ? updateCandidateAction : createCandidateAction,
    IDLE_STATE,
  );

  const value = (field: string, fallback: string | null | undefined) =>
    state.values?.[field] ?? fallback ?? "";

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {candidate ? (
        <input type="hidden" name="candidateId" value={candidate.id} />
      ) : null}

      <FormError message={state.message} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Full name"
          htmlFor="fullName"
          required
          error={state.errors?.fullName}
        >
          <TextInput
            id="fullName"
            name="fullName"
            required
            autoFocus
            maxLength={120}
            placeholder="e.g. Anna Andersson"
            defaultValue={value("fullName", candidate?.full_name)}
            invalid={Boolean(state.errors?.fullName)}
          />
        </Field>

        <Field label="Location" htmlFor="location" error={state.errors?.location}>
          <TextInput
            id="location"
            name="location"
            maxLength={160}
            placeholder="e.g. Stockholm"
            defaultValue={value("location", candidate?.location)}
            invalid={Boolean(state.errors?.location)}
          />
        </Field>

        <Field label="Email" htmlFor="email" error={state.errors?.email}>
          <TextInput
            id="email"
            name="email"
            type="email"
            maxLength={255}
            placeholder="anna@example.com"
            defaultValue={value("email", candidate?.email)}
            invalid={Boolean(state.errors?.email)}
          />
        </Field>

        <Field label="Phone" htmlFor="phone" error={state.errors?.phone}>
          <TextInput
            id="phone"
            name="phone"
            type="tel"
            maxLength={40}
            placeholder="+46 70 123 45 67"
            defaultValue={value("phone", candidate?.phone)}
            invalid={Boolean(state.errors?.phone)}
          />
        </Field>
      </div>

      <Field
        label="LinkedIn URL"
        htmlFor="linkedinUrl"
        error={state.errors?.linkedinUrl}
        hint="Full URL including https://"
      >
        <TextInput
          id="linkedinUrl"
          name="linkedinUrl"
          type="url"
          maxLength={500}
          placeholder="https://www.linkedin.com/in/anna-andersson"
          defaultValue={value("linkedinUrl", candidate?.linkedin_url)}
          invalid={Boolean(state.errors?.linkedinUrl)}
        />
      </Field>

      <Field
        label="CV text"
        htmlFor="cvText"
        error={state.errors?.cvText}
        hint="Paste the CV as plain text. This is what AI Match Analysis reads."
      >
        <TextArea
          id="cvText"
          name="cvText"
          rows={12}
          maxLength={60000}
          placeholder="Experience, skills, education..."
          defaultValue={value("cvText", candidate?.cv_text)}
          invalid={Boolean(state.errors?.cvText)}
        />
      </Field>

      <div className="flex items-center gap-2 border-t border-slate-200 pt-4">
        <SubmitButton pendingLabel={candidate ? "Saving..." : "Creating..."}>
          {candidate ? "Save changes" : "Add candidate"}
        </SubmitButton>
        <LinkButton
          href={candidate ? `/candidates/${candidate.id}` : "/candidates"}
        >
          Cancel
        </LinkButton>
      </div>
    </form>
  );
}
