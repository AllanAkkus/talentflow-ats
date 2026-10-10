"use client";

import {
  AlertTriangle,
  Info,
  RefreshCw,
  Sparkles,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import {
  AI_DISCLAIMER,
  type AiAnalysisResult,
  type AnalyzeCandidateResponse,
} from "@/types/ai";

/**
 * "AI Match Analysis" for one application (candidate x job).
 *
 * The browser only ever sends an application id. Everything else - the job
 * description, the CV text, the prompt and the API key - stays on the server in
 * /api/ai/analyze-candidate.
 */
export function AiMatchPanel({
  applicationId,
  jobTitle,
  configured,
  initialAnalysis,
  initialGeneratedAt,
  initialModel,
  hasCvText,
}: {
  applicationId: string;
  jobTitle: string;
  configured: boolean;
  initialAnalysis: AiAnalysisResult | null;
  initialGeneratedAt: string | null;
  initialModel: string | null;
  hasCvText: boolean;
}) {
  const [analysis, setAnalysis] = useState<AiAnalysisResult | null>(
    initialAnalysis,
  );
  const [generatedAt, setGeneratedAt] = useState<string | null>(
    initialGeneratedAt,
  );
  const [model, setModel] = useState<string | null>(initialModel);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/analyze-candidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });

      const payload: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof (payload as { error: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "Analysis failed. Please try again.";
        setError(message);
        return;
      }

      const data = payload as AnalyzeCandidateResponse;
      setAnalysis(data.analysis);
      setGeneratedAt(data.generatedAt);
      setModel(data.model);
    } catch {
      setError("Could not reach the analysis service. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  if (!configured) {
    return (
      <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
        <p className="flex items-center gap-2 font-medium text-slate-700">
          <Info className="size-4 text-slate-400" />
          AI Match Analysis is not configured in this environment.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Set <code className="rounded bg-slate-200 px-1">OPENAI_API_KEY</code>{" "}
          to enable it. Everything else in TalentFlow works without it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {generatedAt ? (
            <span>
              Last run {new Date(generatedAt).toLocaleString("en-GB")}
              {model ? ` · ${model}` : ""}
            </span>
          ) : (
            <span>Compare this CV against “{jobTitle}”.</span>
          )}
        </div>
        <Button size="sm" onClick={run} disabled={loading}>
          {loading ? (
            <>
              <Spinner className="size-3.5" />
              Analyzing...
            </>
          ) : (
            <>
              {analysis ? (
                <RefreshCw className="size-3.5" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {analysis ? "Re-run analysis" : "Run AI Match Analysis"}
            </>
          )}
        </Button>
      </div>

      {!hasCvText ? (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          This candidate has no CV text yet. The analysis will only have the
          profile fields to work with - add CV text for a useful result.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {analysis ? <AnalysisBody analysis={analysis} /> : null}

      <p className="text-[11px] text-slate-500">{AI_DISCLAIMER}</p>
    </div>
  );
}

function AnalysisBody({ analysis }: { analysis: AiAnalysisResult }) {
  return (
    <div className="space-y-4 rounded-lg bg-slate-50/80 p-4 ring-1 ring-slate-200">
      <div className="flex items-start gap-4">
        <ScoreDial score={analysis.match_score} />
        <p className="text-sm leading-relaxed text-slate-700">
          {analysis.summary}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <AnalysisList
          title="Strengths"
          icon={<ThumbsUp className="size-3.5 text-emerald-600" />}
          items={analysis.strengths}
        />
        <AnalysisList
          title="Gaps"
          icon={<TriangleAlert className="size-3.5 text-amber-600" />}
          items={analysis.gaps}
        />
      </div>

      {analysis.suggested_interview_questions.length > 0 ? (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Suggested interview questions
          </h4>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
            {analysis.suggested_interview_questions.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function AnalysisList({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
}) {
  return (
    <div>
      <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">None identified.</p>
      ) : (
        <ul className="space-y-1.5 text-sm text-slate-700">
          {items.map((item, index) => (
            <li key={index} className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-400" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScoreDial({ score }: { score: number }) {
  const tone =
    score >= 70
      ? "text-emerald-600 ring-emerald-200 bg-emerald-50"
      : score >= 45
        ? "text-amber-600 ring-amber-200 bg-amber-50"
        : "text-slate-600 ring-slate-200 bg-white";

  return (
    <div
      className={cn(
        "flex size-16 shrink-0 flex-col items-center justify-center rounded-xl ring-1",
        tone,
      )}
    >
      <span className="text-xl font-semibold leading-none">{score}</span>
      <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide opacity-70">
        match
      </span>
    </div>
  );
}
