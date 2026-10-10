import "server-only";

import OpenAI from "openai";
import { z } from "zod";

import { OPENAI_MODEL, openAiKey } from "@/lib/env.server";
import { aiAnalysisSchema, type AiAnalysis } from "@/lib/validation/schemas";

/**
 * AI Match Analysis: compare one candidate's CV and profile against one job.
 *
 * Design constraints, in order of importance:
 *  1. Decision support only. The model never decides anything; the prompt
 *     forbids a hire/reject recommendation and the UI carries a disclaimer.
 *  2. Job-relevant evidence only. The prompt explicitly rules out inferring or
 *     scoring protected characteristics (gender, ethnicity, age, religion,
 *     health/disability, sexual orientation, nationality, family status).
 *  3. Structured output. The response is constrained by a JSON schema and then
 *     re-validated with Zod, so a malformed answer surfaces as an error instead
 *     of as broken UI.
 */

export type AnalyzeInput = {
  jobTitle: string;
  jobDescription: string | null;
  jobLocation: string | null;
  employmentType: string | null;
  candidateName: string;
  candidateLocation: string | null;
  candidateCvText: string | null;
};

export type AnalyzeOutcome =
  | { ok: true; analysis: AiAnalysis; model: string }
  | { ok: false; reason: "not_configured" | "no_content" | "invalid_output" | "provider_error"; message: string };

const SYSTEM_PROMPT = `You are an assistant that helps recruiters assess how well a candidate's CV matches a specific job opening.

Rules you must follow:
- Judge ONLY job-relevant evidence: skills, tools, technologies, domain experience, seniority, measurable results, education and certifications that the job actually calls for.
- Never infer, mention, estimate or score any protected characteristic: gender, ethnicity, race, nationality, religion, age, health or disability, sexual orientation, pregnancy, or family or marital status. Ignore names, photos and dates of birth as signals.
- Never recommend hiring or rejecting. You produce decision support for a human recruiter, nothing more.
- Base every statement on what the CV and profile actually say. If the CV is thin or missing, say so in the summary and keep the score low-confidence rather than inventing experience.
- Write in clear, neutral English. Be concrete and brief: each bullet one sentence.

match_score is a 0-100 estimate of evidence-based fit with the job requirements, where 0 means no relevant overlap and 100 means every stated requirement is clearly evidenced.`;

/** JSON Schema handed to the model so the shape is enforced at generation time. */
const RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "match_score",
    "summary",
    "strengths",
    "gaps",
    "suggested_interview_questions",
  ],
  properties: {
    match_score: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description: "Evidence-based fit with the job requirements.",
    },
    summary: {
      type: "string",
      description: "2-4 sentences on how the candidate maps to this job.",
    },
    strengths: {
      type: "array",
      maxItems: 5,
      items: { type: "string" },
      description: "Job-relevant strengths evidenced in the CV.",
    },
    gaps: {
      type: "array",
      maxItems: 5,
      items: { type: "string" },
      description: "Requirements the CV does not evidence.",
    },
    suggested_interview_questions: {
      type: "array",
      maxItems: 5,
      items: { type: "string" },
      description: "Questions that would resolve the gaps above.",
    },
  },
} as const;

function buildUserPrompt(input: AnalyzeInput): string {
  const cv = (input.candidateCvText ?? "").trim();

  return [
    "## Job",
    `Title: ${input.jobTitle}`,
    input.jobLocation ? `Location: ${input.jobLocation}` : null,
    input.employmentType ? `Employment type: ${input.employmentType}` : null,
    "",
    "Description:",
    input.jobDescription?.trim() || "(no description provided)",
    "",
    "## Candidate",
    input.candidateLocation ? `Location: ${input.candidateLocation}` : null,
    "",
    "CV text:",
    cv.length > 0
      ? // Hard cap so a pasted 200-page CV cannot blow up the request.
        cv.slice(0, 20_000)
      : "(no CV text on file - say so in the summary and keep the score low)",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export async function analyzeCandidateMatch(
  input: AnalyzeInput,
): Promise<AnalyzeOutcome> {
  const apiKey = openAiKey();
  if (!apiKey) {
    return {
      ok: false,
      reason: "not_configured",
      message: "AI Match Analysis is not configured in this environment.",
    };
  }

  const client = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 1 });

  let raw: string | null = null;
  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "candidate_match_analysis",
          strict: true,
          schema: RESPONSE_JSON_SCHEMA,
        },
      },
    });

    raw = completion.choices[0]?.message?.content ?? null;
  } catch (error) {
    // Network error, bad key, rate limit, model unavailable. The ATS keeps
    // working; only this panel reports the failure.
    const message =
      error instanceof Error ? error.message : "Unknown provider error";
    return {
      ok: false,
      reason: "provider_error",
      message: `The AI provider could not be reached (${message}).`,
    };
  }

  if (!raw) {
    return {
      ok: false,
      reason: "no_content",
      message: "The model returned an empty response. Try again.",
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      reason: "invalid_output",
      message: "The model returned something that was not valid JSON.",
    };
  }

  // Belt and braces: the JSON schema should already guarantee this, but the
  // app only ever touches data that has passed our own Zod schema.
  const validated = aiAnalysisSchema.safeParse(parsedJson);
  if (!validated.success) {
    return {
      ok: false,
      reason: "invalid_output",
      message: `The model response did not match the expected shape (${z.prettifyError(validated.error).split("\n")[0]}).`,
    };
  }

  return { ok: true, analysis: validated.data, model: OPENAI_MODEL };
}
