"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getWriteContext } from "@/lib/actions/context";
import {
  describeDatabaseError,
  type FormState,
  type MutationResult,
} from "@/lib/actions/state";
import {
  fieldErrors,
  jobSchema,
  jobStatusSchema,
  uuidSchema,
} from "@/lib/validation/schemas";

/**
 * Job mutations. Each action re-authenticates, re-resolves the active
 * organization server-side, validates with Zod, and only then writes.
 */

function readJobForm(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    location: String(formData.get("location") ?? ""),
    employmentType: String(formData.get("employmentType") ?? ""),
    status: String(formData.get("status") ?? "draft"),
  };
}

export async function createJobAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = readJobForm(formData);
  const context = await getWriteContext();
  if (typeof context === "string") {
    return { status: "error", message: context, values: raw };
  }

  const parsed = jobSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      errors: fieldErrors(parsed.error),
      values: raw,
    };
  }

  const { data, error } = await context.supabase
    .from("jobs")
    .insert({
      organization_id: context.organizationId,
      title: parsed.data.title,
      description: parsed.data.description,
      location: parsed.data.location,
      employment_type: parsed.data.employmentType,
      status: parsed.data.status,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      status: "error",
      message: error ? describeDatabaseError(error) : "Could not create the job.",
      values: raw,
    };
  }

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  redirect(`/jobs/${data.id}`);
}

export async function updateJobAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = readJobForm(formData);
  const jobId = uuidSchema.safeParse(String(formData.get("jobId") ?? ""));
  if (!jobId.success) {
    return { status: "error", message: "Unknown job.", values: raw };
  }

  const context = await getWriteContext();
  if (typeof context === "string") {
    return { status: "error", message: context, values: raw };
  }

  const parsed = jobSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error), values: raw };
  }

  const { error, data } = await context.supabase
    .from("jobs")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      location: parsed.data.location,
      employment_type: parsed.data.employmentType,
      status: parsed.data.status,
    })
    .eq("id", jobId.data)
    .eq("organization_id", context.organizationId)
    .select("id");

  if (error) {
    return { status: "error", message: describeDatabaseError(error), values: raw };
  }

  if (!data || data.length === 0) {
    return {
      status: "error",
      message: "Job not found in this organization.",
      values: raw,
    };
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId.data}`);
  revalidatePath("/pipeline");
  redirect(`/jobs/${jobId.data}`);
}

/** Quick status change from the job detail header. */
export async function setJobStatusAction(
  formData: FormData,
): Promise<MutationResult> {
  const jobId = uuidSchema.safeParse(String(formData.get("jobId") ?? ""));
  const status = jobStatusSchema.safeParse(String(formData.get("status") ?? ""));

  if (!jobId.success || !status.success) {
    return { ok: false, message: "Invalid request." };
  }

  const context = await getWriteContext();
  if (typeof context === "string") {
    return { ok: false, message: context };
  }

  const { error } = await context.supabase
    .from("jobs")
    .update({ status: status.data })
    .eq("id", jobId.data)
    .eq("organization_id", context.organizationId);

  if (error) {
    return { ok: false, message: describeDatabaseError(error) };
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId.data}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteJobAction(formData: FormData): Promise<void> {
  const jobId = uuidSchema.safeParse(String(formData.get("jobId") ?? ""));
  if (!jobId.success) return;

  const context = await getWriteContext();
  if (typeof context === "string") return;

  await context.supabase
    .from("jobs")
    .delete()
    .eq("id", jobId.data)
    .eq("organization_id", context.organizationId);

  revalidatePath("/jobs");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  redirect("/jobs");
}
