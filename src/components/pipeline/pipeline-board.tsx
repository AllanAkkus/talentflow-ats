"use client";

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AlertTriangle, GripVertical, Search, X } from "lucide-react";
import { LinkedInIcon } from "@/components/ui/icons";
import Link from "next/link";
import { useMemo, useOptimistic, useState, useTransition } from "react";

import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/primitives";
import { updateApplicationStageAction } from "@/lib/actions/applications";
import {
  BOARD_STAGES,
  PIPELINE_STAGES,
  STAGE_LABELS,
  STAGE_STYLES,
} from "@/lib/constants";
import type { BoardApplication } from "@/types/ats";
import {
  ALL_JOBS,
  DEFAULT_FILTERS,
  filterApplications,
  groupByStage,
  type PipelineFilters,
} from "@/lib/pipeline/filter";
import { cn } from "@/lib/utils";
import type { Job, PipelineStage } from "@/types/database";

type JobOption = Pick<Job, "id" | "title" | "status">;

/**
 * The Kanban board.
 *
 * Filtering runs in the browser over the organization's applications, so
 * selecting a job or typing a name is instant with no round-trip. Stage changes
 * go through the same server action as the dropdown on the detail pages:
 * optimistic locally, rolled back with an error banner if Postgres rejects it.
 */
export function PipelineBoard({
  applications,
  jobs,
}: {
  applications: BoardApplication[];
  jobs: JobOption[];
}) {
  const [filters, setFilters] = useState<PipelineFilters>(DEFAULT_FILTERS);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  /*
   * `useOptimistic` holds the stage overrides applied by a drag that has not
   * been confirmed yet. When the server action finishes, `revalidatePath` sends
   * fresh props and the override is dropped automatically.
   */
  const [stageOverrides, applyStageOverride] = useOptimistic<
    Record<string, PipelineStage>,
    { applicationId: string; stage: PipelineStage }
  >({}, (current, change) => ({
    ...current,
    [change.applicationId]: change.stage,
  }));

  const withOverrides = useMemo(
    () =>
      applications.map((application) =>
        stageOverrides[application.id]
          ? { ...application, stage: stageOverrides[application.id] }
          : application,
      ),
    [applications, stageOverrides],
  );

  const visible = useMemo(
    () => filterApplications(withOverrides, filters),
    [withOverrides, filters],
  );

  const grouped = useMemo(() => groupByStage(visible), [visible]);
  const columns = filters.showRejected
    ? ([...BOARD_STAGES, "rejected"] as PipelineStage[])
    : ([...BOARD_STAGES] as PipelineStage[]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // A small threshold so clicking a link or the stage dropdown on a card
      // is not swallowed by the drag sensor.
      activationConstraint: { distance: 6 },
    }),
  );

  function move(applicationId: string, stage: PipelineStage) {
    setError(null);
    startTransition(async () => {
      applyStageOverride({ applicationId, stage });
      const result = await updateApplicationStageAction({ applicationId, stage });
      if (!result.ok) {
        // The optimistic override is discarded when the transition ends, so the
        // card snaps back to its server state on its own.
        setError(result.message);
      }
    });
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const applicationId = String(event.active.id);
    const target = event.over?.id ? String(event.over.id) : null;
    if (!target) return;

    const current = withOverrides.find((item) => item.id === applicationId);
    if (!current || current.stage === target) return;

    move(applicationId, target as PipelineStage);
  }

  function onDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  const rejectedCount = withOverrides.filter(
    (application) => application.stage === "rejected",
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200/80 sm:flex-row sm:items-center">
        <div>
          <label
            htmlFor="pipeline-job"
            className="sr-only"
          >
            Filter by job
          </label>
          <select
            id="pipeline-job"
            value={filters.jobId}
            onChange={(event) =>
              setFilters((current) => ({ ...current, jobId: event.target.value }))
            }
            className="h-9 w-full rounded-lg bg-white px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-300 focus:ring-2 focus:ring-indigo-500 sm:w-56"
          >
            <option value={ALL_JOBS}>All jobs</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
                {job.status !== "open" ? ` (${job.status})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <label htmlFor="pipeline-search" className="sr-only">
            Search candidates by name
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            id="pipeline-search"
            type="search"
            value={filters.query}
            onChange={(event) =>
              setFilters((current) => ({ ...current, query: event.target.value }))
            }
            placeholder="Search candidate name..."
            className="h-9 w-full rounded-lg bg-white pl-9 pr-8 text-sm text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
          />
          {filters.query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setFilters((current) => ({ ...current, query: "" }))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 sm:ml-auto">
          <input
            type="checkbox"
            checked={filters.showRejected}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                showRejected: event.target.checked,
              }))
            }
            className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Show rejected ({rejectedCount})
        </label>
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200"
        >
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {applications.length === 0 ? (
        <div className="rounded-xl bg-white ring-1 ring-slate-200/80">
          <EmptyState
            title="Nothing in the pipeline yet"
            description="Assign a candidate to a job to create an application. It appears here in the New column."
            actionLabel="Go to candidates"
            actionHref="/candidates"
          />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDraggingId(null)}
        >
          <div className="tf-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
            {columns.map((stage) => (
              <StageColumn
                key={stage}
                stage={stage}
                applications={grouped[stage]}
                draggingId={draggingId}
                onMove={move}
              />
            ))}
          </div>
        </DndContext>
      )}

      <p className="text-xs text-slate-500">
        Drag a card between columns, or use the stage dropdown on the card. Both
        save immediately.
      </p>
    </div>
  );
}

function StageColumn({
  stage,
  applications,
  draggingId,
  onMove,
}: {
  stage: PipelineStage;
  applications: BoardApplication[];
  draggingId: string | null;
  onMove: (applicationId: string, stage: PipelineStage) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const styles = STAGE_STYLES[stage];

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={cn("size-2 rounded-full", styles.dot)} />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          {STAGE_LABELS[stage]}
        </h2>
        <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-medium text-slate-600">
          {applications.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-40 flex-1 flex-col gap-2 rounded-xl p-2 transition-colors",
          isOver ? "bg-indigo-50 ring-1 ring-indigo-300" : "bg-slate-100/70",
        )}
      >
        {applications.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-slate-400">
            {isOver ? "Drop here" : "No candidates"}
          </p>
        ) : (
          applications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              isDragging={draggingId === application.id}
              onMove={onMove}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ApplicationCard({
  application,
  isDragging,
  onMove,
}: {
  application: BoardApplication;
  isDragging: boolean;
  onMove: (applicationId: string, stage: PipelineStage) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform } =
    useDraggable({ id: application.id });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg bg-white p-2.5 shadow-xs ring-1 ring-slate-200 transition-shadow",
        isDragging && "z-10 shadow-lg ring-indigo-300",
      )}
    >
      <div className="flex items-start gap-2">
        {/*
          Only this handle starts a drag. Making the whole card draggable would
          fight with the links and the stage dropdown inside it.
        */}
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={`Drag ${application.candidate.full_name}`}
          className="-ml-1 cursor-grab touch-none rounded p-0.5 text-slate-300 hover:text-slate-500 active:cursor-grabbing"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-4" />
        </button>

        <Avatar name={application.candidate.full_name} size="xs" />

        <div className="min-w-0 flex-1">
          <Link
            href={`/candidates/${application.candidate.id}`}
            className="block truncate text-xs font-semibold text-slate-900 hover:text-indigo-700"
          >
            {application.candidate.full_name}
          </Link>
          <Link
            href={`/jobs/${application.job.id}`}
            className="block truncate text-[11px] text-slate-500 hover:text-indigo-600"
          >
            {application.job.title}
          </Link>
        </div>

        {application.candidate.linkedin_url ? (
          <a
            href={application.candidate.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`LinkedIn profile for ${application.candidate.full_name}`}
            className="rounded p-0.5 text-sky-600 hover:bg-sky-50"
          >
            <LinkedInIcon className="size-3.5" />
          </a>
        ) : null}
      </div>

      {application.candidate.email ? (
        <a
          href={`mailto:${application.candidate.email}`}
          className="mt-1.5 block truncate pl-6 text-[11px] text-slate-400 hover:text-indigo-600"
        >
          {application.candidate.email}
        </a>
      ) : null}

      {/*
        The dropdown is the reliable path: it works without a pointer, on
        touch, and for keyboard users. Drag-and-drop is the shortcut on top.
        Both call the board's single `onMove`, so there is one code path to the
        server and they can never disagree.
      */}
      <div className="mt-2 pl-6">
        <label className="sr-only" htmlFor={`board-stage-${application.id}`}>
          Stage for {application.candidate.full_name}
        </label>
        <select
          id={`board-stage-${application.id}`}
          value={application.stage}
          onChange={(event) =>
            onMove(application.id, event.target.value as PipelineStage)
          }
          className="h-7 w-full rounded-md bg-slate-50 px-1.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500"
        >
          {PIPELINE_STAGES.map((option) => (
            <option key={option} value={option}>
              {STAGE_LABELS[option]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
