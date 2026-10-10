"use server";

import { revalidatePath } from "next/cache";

import { getWriteContext } from "@/lib/actions/context";
import {
  describeDatabaseError,
  type FormState,
  type MutationResult,
} from "@/lib/actions/state";
import {
  applicationSchema,
  fieldErrors,
  stageUpdateSchema,
  uuidSchema,
} from "@/lib/validation/schemas";

/**
 * Application mutations: assigning a candidate to a job, moving them through
 * the pipeline, and removing an application.
 *
 * Assigning a candidate to a job IS creating an application - that is the
 * candidate<->job relationship. The default stage is `new`.
 */

export async function createApplicationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = {
    candidateId: String(formData.get("candidateId") ?? ""),
    jobId: String(formData.get("jobId") ?? ""),
    stage: String(formData.get("stage") ?? "new"),
    notes: String(formData.get("notes") ?? ""),
  };

  const context = await getWriteContext();
  if (typeof context === "string") {
    return { status: "error", message: context, values: raw };
  }

  const parsed = applicationSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error), values: raw };
  }

  /*
   * Both ids are re-checked against the active organization before insert.
   * The composite foreign keys would reject a cross-tenant pair anyway, but
   * checking here produces a readable message instead of a constraint error.
   */
  const [{ data: candidate }, { data: job }] = await Promise.all([
    context.supabase
      .from("candidates")
      .select("id")
      .eq("id", parsed.data.candidateId)
      .eq("organization_id", context.organizationId)
      .maybeSingle(),
    context.supabase
      .from("jobs")
      .select("id")
      .eq("id", parsed.data.jobId)
      .eq("organization_id", context.organizationId)
      .maybeSingle(),
  ]);

  if (!candidate) {
    return {
      status: "error",
      errors: { candidateId: "Candidate not found in this organization" },
      values: raw,
    };
  }
  if (!job) {
    return {
      status: "error",
      errors: { jobId: "Job not found in this organization" },
      values: raw,
    };
  }

  const { error } = await context.supabase.from("applications").insert({
    organization_id: context.organizationId,
    candidate_id: parsed.data.candidateId,
    job_id: parsed.data.jobId,
    stage: parsed.data.stage,
    notes: parsed.data.notes,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        message: "This candidate is already on that job.",
        values: raw,
      };
    }
    return { status: "error", message: describeDatabaseError(error), values: raw };
  }

  revalidatePath("/pipeline");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${parsed.data.jobId}`);
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${parsed.data.candidateId}`);
  revalidatePath("/dashboard");

  return { status: "success", message: "Candidate added to the job." };
}

/**
 * Move an application to another pipeline stage.
 *
 * Returns a plain result rather than redirecting, so both the dropdown and the
 * drag-and-drop board can call it and roll their UI back on failure.
 */
export async function updateApplicationStageAction(
  input: unknown,
): Promise<MutationResult> {
  const parsed = stageUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid stage change." };
  }

  const context = await getWriteContext();
  if (typeof context === "string") {
    return { ok: false, message: context };
  }

  const { data, error } = await context.supabase
    .from("applications")
    .update({ stage: parsed.data.stage })
    .eq("id", parsed.data.applicationId)
    .eq("organization_id", context.organizationId)
    .select("id");

  if (error) {
    return { ok: false, message: describeDatabaseError(error) };
  }

  if (!data || data.length === 0) {
    return { ok: false, message: "Application not found in this organization." };
  }

  revalidatePath("/pipeline");
  revalidatePath("/candidates");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateApplicationNotesAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const applicationId = uuidSchema.safeParse(
    String(formData.get("applicationId") ?? ""),
  );
  if (!applicationId.success) {
    return { status: "error", message: "Unknown application." };
  }

  const notes = String(formData.get("notes") ?? "").trim();

  const context = await getWriteContext();
  if (typeof context === "string") {
    return { status: "error", message: context };
  }

  const { error } = await context.supabase
    .from("applications")
    .update({ notes: notes.length === 0 ? null : notes.slice(0, 5000) })
    .eq("id", applicationId.data)
    .eq("organization_id", context.organizationId);

  if (error) {
    return { status: "error", message: describeDatabaseError(error) };
  }

  revalidatePath("/pipeline");
  return { status: "success", message: "Note saved." };
}

export async function deleteApplicationAction(
  formData: FormData,
): Promise<MutationResult> {
  const applicationId = uuidSchema.safeParse(
    String(formData.get("applicationId") ?? ""),
  );
  if (!applicationId.success) {
    return { ok: false, message: "Invalid request." };
  }

  const context = await getWriteContext();
  if (typeof context === "string") {
    return { ok: false, message: context };
  }

  const { error } = await context.supabase
    .from("applications")
    .delete()
    .eq("id", applicationId.data)
    .eq("organization_id", context.organizationId);

  if (error) {
    return { ok: false, message: describeDatabaseError(error) };
  }

  revalidatePath("/pipeline");
  revalidatePath("/candidates");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { ok: true };
}
