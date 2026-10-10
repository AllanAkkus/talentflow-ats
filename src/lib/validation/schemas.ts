import { z } from "zod";

import { EMPLOYMENT_TYPES } from "@/lib/constants";
import type { EmploymentType } from "@/types/database";

/**
 * Every write path in the app parses its input with one of these schemas before
 * it touches the database. The same schemas back the server actions and the
 * JSON API routes, so client and server cannot drift apart.
 */

/** Optional free text: trims, and collapses "" / whitespace / undefined to null. */
const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Must be ${max} characters or fewer`)
    .nullish()
    .transform((value) => {
      const trimmed = (value ?? "").trim();
      return trimmed.length === 0 ? null : trimmed;
    });

export const uuidSchema = z.uuid("Not a valid id");

/**
 * Normalise *before* validating. Doing it the other way round rejects a login
 * email that merely has a trailing space, which is exactly what a browser
 * autofill or a copy-paste tends to produce.
 */
export const emailSchema = z
  .string()
  .max(255)
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.email("Enter a valid email address"));

const optionalEmailSchema = z
  .string()
  .max(255)
  .nullish()
  .transform((value) => {
    const trimmed = (value ?? "").trim().toLowerCase();
    return trimmed.length === 0 ? null : trimmed;
  })
  .refine((value) => value === null || z.email().safeParse(value).success, {
    message: "Enter a valid email address",
  });

/**
 * LinkedIn URLs are pasted by hand, so the rule is "must be a real http(s)
 * URL" rather than a strict linkedin.com match - recruiters also paste country
 * subdomains and vanity domains. Rejecting anything that is not http(s) is what
 * keeps `javascript:` out of an href.
 */
export const linkedinUrlSchema = z
  .string()
  .max(500)
  .nullish()
  .transform((value) => {
    const trimmed = (value ?? "").trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  .refine(
    (value) => {
      if (value === null) return true;
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Enter a full URL starting with https://" },
  );

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(72, "Password must be 72 characters or fewer")
  .refine((value) => /[a-zA-Z]/.test(value), {
    message: "Password must contain at least one letter",
  })
  .refine((value) => /[0-9]/.test(value), {
    message: "Password must contain at least one number",
  });

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Enter a full name")
  .max(120, "Name is too long");

export const organizationNameSchema = z
  .string()
  .trim()
  .min(2, "Organization name is required")
  .max(160, "Organization name is too long");

export const roleSchema = z.enum(["admin", "customer"]);

export const jobStatusSchema = z.enum(["draft", "open", "closed"]);

export const stageSchema = z.enum([
  "new",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
]);

export const employmentTypeSchema = z
  .string()
  .nullish()
  .transform((value) => {
    const trimmed = (value ?? "").trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  .refine(
    (value) =>
      value === null || (EMPLOYMENT_TYPES as readonly string[]).includes(value),
    { message: "Choose a valid employment type" },
  )
  .transform((value) => value as EmploymentType | null);

// -----------------------------------------------------------------------------
// Login
// -----------------------------------------------------------------------------
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

// -----------------------------------------------------------------------------
// Admin user creation (POST /api/admin/users)
// -----------------------------------------------------------------------------
export const createUserSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    fullName: fullNameSchema,
    role: roleSchema,
    /** Create a brand new organization for this customer. */
    organizationName: organizationNameSchema.optional(),
    /** Or attach the customer to an organization that already exists. */
    organizationId: uuidSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === "customer") {
      if (!value.organizationName && !value.organizationId) {
        ctx.addIssue({
          code: "custom",
          path: ["organizationName"],
          message: "A customer must belong to an organization",
        });
      }
      return;
    }

    // Platform admins are global, so an organization would be meaningless and
    // the profiles check constraint would reject the row anyway.
    if (value.organizationName || value.organizationId) {
      ctx.addIssue({
        code: "custom",
        path: ["role"],
        message: "Platform admins are not attached to an organization",
      });
    }
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;

// -----------------------------------------------------------------------------
// Organizations
// -----------------------------------------------------------------------------
export const organizationSchema = z.object({
  name: organizationNameSchema,
});

// -----------------------------------------------------------------------------
// Jobs
// -----------------------------------------------------------------------------
export const jobSchema = z.object({
  title: z.string().trim().min(2, "Job title is required").max(160),
  description: optionalText(20_000),
  location: optionalText(160),
  employmentType: employmentTypeSchema,
  status: jobStatusSchema,
});

export type JobInput = z.infer<typeof jobSchema>;

// -----------------------------------------------------------------------------
// Candidates
// -----------------------------------------------------------------------------
export const candidateSchema = z.object({
  fullName: fullNameSchema,
  email: optionalEmailSchema,
  phone: optionalText(40),
  linkedinUrl: linkedinUrlSchema,
  location: optionalText(160),
  cvText: optionalText(60_000),
});

export type CandidateInput = z.infer<typeof candidateSchema>;

// -----------------------------------------------------------------------------
// Applications
// -----------------------------------------------------------------------------
export const applicationSchema = z.object({
  candidateId: uuidSchema,
  jobId: uuidSchema,
  stage: stageSchema,
  notes: optionalText(5_000),
});

export const stageUpdateSchema = z.object({
  applicationId: uuidSchema,
  stage: stageSchema,
});

// -----------------------------------------------------------------------------
// AI Match Analysis
// -----------------------------------------------------------------------------
export const analyzeRequestSchema = z.object({
  applicationId: uuidSchema,
});

/**
 * The shape the model is forced to return. Deliberately contains no field that
 * could hold a protected characteristic - the model is asked for job-relevant
 * evidence only.
 */
export const aiAnalysisSchema = z.object({
  match_score: z.number().int().min(0).max(100),
  summary: z.string().min(1).max(1200),
  strengths: z.array(z.string().min(1).max(400)).max(8),
  gaps: z.array(z.string().min(1).max(400)).max(8),
  suggested_interview_questions: z.array(z.string().min(1).max(400)).max(8),
});

export type AiAnalysis = z.infer<typeof aiAnalysisSchema>;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Flattens a ZodError into `{ field: "message" }` for inline form errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}

/** First human-readable message from a ZodError, for toast-style errors. */
export function firstErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
