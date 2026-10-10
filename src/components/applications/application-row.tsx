"use client";

import { Mail, Sparkles, Trash2 } from "lucide-react";
import { LinkedInIcon } from "@/components/ui/icons";
import Link from "next/link";
import { useState, useTransition } from "react";

import { AiMatchPanel } from "@/components/candidates/ai-match-panel";
import { StageSelect } from "@/components/pipeline/stage-select";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/primitives";
import { deleteApplicationAction } from "@/lib/actions/applications";
import type { AiAnalysisResult } from "@/types/ai";
import type { PipelineStage } from "@/types/database";

/**
 * One application, as shown on the job detail and candidate detail pages.
 *
 * Carries everything a recruiter needs for that row: the stage control, the
 * contact shortcuts, the AI Match Analysis panel (collapsed by default so a
 * page with ten applications stays readable) and removal.
 */
export function ApplicationRow({
  applicationId,
  stage,
  title,
  href,
  subtitle,
  email,
  linkedinUrl,
  jobTitle,
  showAvatar,
  aiConfigured,
  hasCvText,
  initialAnalysis,
  initialGeneratedAt,
  initialModel,
}: {
  applicationId: string;
  stage: PipelineStage;
  title: string;
  href: string;
  subtitle?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  jobTitle: string;
  showAvatar: boolean;
  aiConfigured: boolean;
  hasCvText: boolean;
  initialAnalysis: AiAnalysisResult | null;
  initialGeneratedAt: string | null;
  initialModel: string | null;
}) {
  const [showAi, setShowAi] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemoving, startRemoving] = useTransition();

  function remove() {
    setRemoveError(null);
    const formData = new FormData();
    formData.set("applicationId", applicationId);

    startRemoving(async () => {
      const result = await deleteApplicationAction(formData);
      if (!result.ok) {
        setRemoveError(result.message);
      }
    });
  }

  return (
    <li className="px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {showAvatar ? <Avatar name={title} size="sm" /> : null}
          <div className="min-w-0">
            <Link
              href={href}
              className="truncate text-sm font-semibold text-slate-900 hover:text-indigo-700"
            >
              {title}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
              {subtitle ? <span className="truncate">{subtitle}</span> : null}
              {email ? (
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-1 hover:text-indigo-600"
                >
                  <Mail className="size-3" />
                  {email}
                </a>
              ) : null}
              {linkedinUrl ? (
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-800"
                >
                  <LinkedInIcon className="size-3" />
                  LinkedIn
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <StageSelect applicationId={applicationId} stage={stage} />
          <button
            type="button"
            onClick={() => setShowAi((open) => !open)}
            aria-expanded={showAi}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 transition-colors hover:bg-indigo-50"
          >
            <Sparkles className="size-3.5" />
            AI match
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={isRemoving}
            aria-label={`Remove ${title} from ${jobTitle}`}
            className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
          >
            {isRemoving ? <Spinner className="size-3.5" /> : <Trash2 className="size-3.5" />}
          </button>
        </div>
      </div>

      {removeError ? (
        <p role="alert" className="mt-2 text-xs font-medium text-rose-600">
          {removeError}
        </p>
      ) : null}

      {showAi ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <AiMatchPanel
            applicationId={applicationId}
            jobTitle={jobTitle}
            configured={aiConfigured}
            hasCvText={hasCvText}
            initialAnalysis={initialAnalysis}
            initialGeneratedAt={initialGeneratedAt}
            initialModel={initialModel}
          />
        </div>
      ) : null}
    </li>
  );
}
