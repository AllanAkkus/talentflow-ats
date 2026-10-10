"use client";

import { useState, useTransition } from "react";

import { updateApplicationStageAction } from "@/lib/actions/applications";
import { PIPELINE_STAGES, STAGE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/types/database";

/**
 * The primary, always-reliable way to move a candidate through the pipeline.
 *
 * Optimistic: the select updates immediately, then rolls back and shows an
 * error if the server rejects the change. Drag-and-drop on the Kanban board is
 * a convenience layer on top of this same server action.
 */
export function StageSelect({
  applicationId,
  stage,
  className,
}: {
  applicationId: string;
  stage: PipelineStage;
  className?: string;
}) {
  const [value, setValue] = useState<PipelineStage>(stage);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function change(next: PipelineStage) {
    const previous = value;
    setValue(next);
    setError(null);

    startTransition(async () => {
      const result = await updateApplicationStageAction({
        applicationId,
        stage: next,
      });

      if (!result.ok) {
        setValue(previous);
        setError(result.message);
      }
    });
  }

  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      <label className="sr-only" htmlFor={`stage-${applicationId}`}>
        Pipeline stage
      </label>
      <select
        id={`stage-${applicationId}`}
        value={value}
        disabled={isPending}
        onChange={(event) => change(event.target.value as PipelineStage)}
        className="h-8 rounded-lg bg-white px-2 text-xs font-medium text-slate-700 ring-1 ring-slate-300 focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
      >
        {PIPELINE_STAGES.map((option) => (
          <option key={option} value={option}>
            {STAGE_LABELS[option]}
          </option>
        ))}
      </select>
      {error ? (
        <span role="alert" className="text-[11px] font-medium text-rose-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}
