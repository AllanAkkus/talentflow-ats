"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getWriteContext } from "@/lib/actions/context";
import { describeDatabaseError, type FormState } from "@/lib/actions/state";
import { candidateSchema, fieldErrors, uuidSchema } from "@/lib/validation/schemas";

function readCandidateForm(formData: FormData) {
  return {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    linkedinUrl: String(formData.get("linkedinUrl") ?? ""),
    location: String(formData.get("location") ?? ""),
    cvText: String(formData.get("cvText") ?? ""),
  };
}

export async function createCandidateAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = readCandidateForm(formData);
  const context = await getWriteContext();
  if (typeof context === "string") {
    return { status: "error", message: context, values: raw };
  }

  const parsed = candidateSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error), values: raw };
  }

  const { data, error } = await context.supabase
    .from("candidates")
    .insert({
      organization_id: context.organizationId,
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      linkedin_url: parsed.data.linkedinUrl,
      location: parsed.data.location,
      cv_text: parsed.data.cvText,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      status: "error",
      message: error
        ? describeDatabaseError(error)
        : "Could not create the candidate.",
      values: raw,
    };
  }

  revalidatePath("/candidates");
  revalidatePath("/dashboard");
  redirect(`/candidates/${data.id}`);
}

export async function updateCandidateAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = readCandidateForm(formData);
  const candidateId = uuidSchema.safeParse(
    String(formData.get("candidateId") ?? ""),
  );
  if (!candidateId.success) {
    return { status: "error", message: "Unknown candidate.", values: raw };
  }

  const context = await getWriteContext();
  if (typeof context === "string") {
    return { status: "error", message: context, values: raw };
  }

  const parsed = candidateSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error), values: raw };
  }

  const { error, data } = await context.supabase
    .from("candidates")
    .update({
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      linkedin_url: parsed.data.linkedinUrl,
      location: parsed.data.location,
      cv_text: parsed.data.cvText,
    })
    .eq("id", candidateId.data)
    .eq("organization_id", context.organizationId)
    .select("id");

  if (error) {
    return { status: "error", message: describeDatabaseError(error), values: raw };
  }

  if (!data || data.length === 0) {
    return {
      status: "error",
      message: "Candidate not found in this organization.",
      values: raw,
    };
  }

  revalidatePath("/candidates");
  revalidatePath(`/candidates/${candidateId.data}`);
  revalidatePath("/pipeline");
  redirect(`/candidates/${candidateId.data}`);
}

export async function deleteCandidateAction(formData: FormData): Promise<void> {
  const candidateId = uuidSchema.safeParse(
    String(formData.get("candidateId") ?? ""),
  );
  if (!candidateId.success) return;

  const context = await getWriteContext();
  if (typeof context === "string") return;

  await context.supabase
    .from("candidates")
    .delete()
    .eq("id", candidateId.data)
    .eq("organization_id", context.organizationId);

  revalidatePath("/candidates");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  redirect("/candidates");
}
