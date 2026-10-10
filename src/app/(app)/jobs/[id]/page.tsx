import { ArrowLeft, Pencil, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ApplicationRow } from "@/components/applications/application-row";
import { AssignDialog } from "@/components/applications/assign-dialog";
import { NoOrganization } from "@/components/layout/no-organization";
import { LinkButton } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import {
  Badge,
  Card,
  CardHeader,
  DetailRow,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { deleteJobAction } from "@/lib/actions/jobs";
import {
  EMPLOYMENT_TYPE_LABELS,
  JOB_STATUS_LABELS,
  JOB_STATUS_STYLES,
  PIPELINE_STAGES,
  STAGE_LABELS,
  STAGE_STYLES,
} from "@/lib/constants";
import {
  getJob,
  listBoardApplications,
  listCandidateOptions,
  listLatestAssessments,
} from "@/lib/data/ats";
import { isAiConfigured } from "@/lib/env.server";
import { requireWorkspace } from "@/lib/permissions/workspace";
import { formatDate } from "@/lib/utils";
import type { AiAnalysisResult } from "@/types/ai";

export const metadata: Metadata = { title: "Job" };

export default async function JobDetailPage(props: PageProps<"/jobs/[id]">) {
  const { id } = await props.params;
  const workspace = await requireWorkspace();

  if (!workspace.organizationId) {
    return (
      <>
        <PageHeader title="Job" />
        <NoOrganization isAdmin={workspace.isAdmin} />
      </>
    );
  }

  const organizationId = workspace.organizationId;
  const job = await getJob(organizationId, id);
  if (!job) notFound();

  const [applications, candidateOptions] = await Promise.all([
    listBoardApplications(organizationId, { jobId: job.id }),
    listCandidateOptions(organizationId),
  ]);

  const assessments = await listLatestAssessments(
    organizationId,
    applications.map((application) => application.id),
  );

  const assignedCandidateIds = new Set(
    applications.map((application) => application.candidate.id),
  );
  const availableCandidates = candidateOptions.filter(
    (candidate) => !assignedCandidateIds.has(candidate.id),
  );

  const aiConfigured = isAiConfigured();

  // Stage counts for the summary card, in the canonical pipeline order.
  const stageBreakdown = PIPELINE_STAGES.map(
    (stage) =>
      [
        stage,
        applications.filter((application) => application.stage === stage).length,
      ] as const,
  ).filter(([, count]) => count > 0);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/jobs"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="size-3.5" />
        All jobs
      </Link>

      <PageHeader
        title={job.title}
        description={`Created ${formatDate(job.created_at)} · last updated ${formatDate(job.updated_at)}`}
        actions={
          <>
            <LinkButton href={`/jobs/${job.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </LinkButton>
            <ConfirmSubmit
              action={deleteJobAction}
              hiddenFields={{ jobId: job.id }}
              triggerLabel="Delete"
              title={`Delete “${job.title}”?`}
              description="This also removes every application on this job. Candidates themselves are kept in the talent pool."
              confirmLabel="Delete job"
            />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 lg:order-1">
          <Card>
            <CardHeader
              title="Candidates on this job"
              description={`${applications.length} application${applications.length === 1 ? "" : "s"}`}
              action={
                <AssignDialog
                  mode="pick-candidate"
                  fixedId={job.id}
                  options={availableCandidates.map((candidate) => ({
                    id: candidate.id,
                    label: candidate.full_name,
                  }))}
                  triggerLabel="Add candidate"
                  emptyMessage={
                    candidateOptions.length === 0
                      ? "There are no candidates in this organization yet. Add one under Candidates first."
                      : "Every candidate in this organization is already on this job."
                  }
                />
              }
            />
            {applications.length === 0 ? (
              <EmptyState
                icon={<Users className="size-5" />}
                title="No candidates yet"
                description="Add a candidate to create an application and start the pipeline for this role."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {applications.map((application) => {
                  const assessment = assessments.get(application.id);
                  return (
                    <ApplicationRow
                      key={application.id}
                      applicationId={application.id}
                      stage={application.stage}
                      title={application.candidate.full_name}
                      href={`/candidates/${application.candidate.id}`}
                      subtitle={application.candidate.location}
                      email={application.candidate.email}
                      linkedinUrl={application.candidate.linkedin_url}
                      jobTitle={job.title}
                      showAvatar
                      aiConfigured={aiConfigured}
                      hasCvText={application.candidate.hasCvText}
                      initialAnalysis={
                        assessment
                          ? ({
                              match_score: assessment.match_score,
                              summary: assessment.summary,
                              strengths: assessment.strengths,
                              gaps: assessment.gaps,
                              suggested_interview_questions:
                                assessment.interview_questions,
                            } satisfies AiAnalysisResult)
                          : null
                      }
                      initialGeneratedAt={assessment?.created_at ?? null}
                      initialModel={assessment?.model ?? null}
                    />
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:order-2">
          <Card className="p-5">
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Status">
                <Badge className={JOB_STATUS_STYLES[job.status]}>
                  {JOB_STATUS_LABELS[job.status]}
                </Badge>
              </DetailRow>
              <DetailRow label="Location">{job.location ?? "-"}</DetailRow>
              <DetailRow label="Employment type">
                {job.employment_type
                  ? EMPLOYMENT_TYPE_LABELS[job.employment_type]
                  : "-"}
              </DetailRow>
              <DetailRow label="Pipeline">
                {stageBreakdown.length === 0 ? (
                  <span className="text-slate-400">-</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {stageBreakdown.map(([stage, count]) => (
                      <Badge key={stage} className={STAGE_STYLES[stage].badge}>
                        {STAGE_LABELS[stage]} {count}
                      </Badge>
                    ))}
                  </div>
                )}
              </DetailRow>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Description" />
            <div className="px-5 py-4">
              {job.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {job.description}
                </p>
              ) : (
                <p className="text-sm text-slate-400">
                  No description yet. AI Match Analysis works best when the job
                  description lists concrete requirements.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
