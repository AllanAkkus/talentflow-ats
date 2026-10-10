import { ArrowLeft, Briefcase, FileText, Mail, MapPin, Pencil, Phone } from "lucide-react";
import { LinkedInIcon } from "@/components/ui/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ApplicationRow } from "@/components/applications/application-row";
import { AssignDialog } from "@/components/applications/assign-dialog";
import { NoOrganization } from "@/components/layout/no-organization";
import { Avatar } from "@/components/ui/avatar";
import { LinkButton } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import {
  Card,
  CardHeader,
  DetailRow,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { deleteCandidateAction } from "@/lib/actions/candidates";
import {
  getCandidate,
  listBoardApplications,
  listJobOptions,
  listLatestAssessments,
} from "@/lib/data/ats";
import { isAiConfigured } from "@/lib/env";
import { requireWorkspace } from "@/lib/permissions/workspace";
import { formatDate } from "@/lib/utils";
import type { AiAnalysisResult } from "@/types/ai";

export const metadata: Metadata = { title: "Candidate" };

export default async function CandidateDetailPage(
  props: PageProps<"/candidates/[id]">,
) {
  const { id } = await props.params;
  const workspace = await requireWorkspace();

  if (!workspace.organizationId) {
    return (
      <>
        <PageHeader title="Candidate" />
        <NoOrganization isAdmin={workspace.isAdmin} />
      </>
    );
  }

  const organizationId = workspace.organizationId;
  const candidate = await getCandidate(organizationId, id);
  if (!candidate) notFound();

  const [applications, jobOptions] = await Promise.all([
    listBoardApplications(organizationId, { candidateId: candidate.id }),
    listJobOptions(organizationId),
  ]);

  const assessments = await listLatestAssessments(
    organizationId,
    applications.map((application) => application.id),
  );

  const assignedJobIds = new Set(
    applications.map((application) => application.job.id),
  );
  const availableJobs = jobOptions.filter((job) => !assignedJobIds.has(job.id));
  const hasCvText = (candidate.cv_text ?? "").trim().length > 0;
  const aiConfigured = isAiConfigured();

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/candidates"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="size-3.5" />
        All candidates
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={candidate.full_name} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              {candidate.full_name}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Added {formatDate(candidate.created_at)} ·{" "}
              {applications.length} application
              {applications.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href={`/candidates/${candidate.id}/edit`}>
            <Pencil className="size-4" />
            Edit
          </LinkButton>
          <ConfirmSubmit
            action={deleteCandidateAction}
            hiddenFields={{ candidateId: candidate.id }}
            triggerLabel="Delete"
            title={`Delete ${candidate.full_name}?`}
            description="This removes the candidate and all of their applications from this organization. It cannot be undone."
            confirmLabel="Delete candidate"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:order-2">
          <Card className="p-5">
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Email">
                {candidate.email ? (
                  <a
                    href={`mailto:${candidate.email}`}
                    className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700"
                  >
                    <Mail className="size-3.5" />
                    {candidate.email}
                  </a>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </DetailRow>
              <DetailRow label="Phone">
                {candidate.phone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-3.5 text-slate-400" />
                    {candidate.phone}
                  </span>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </DetailRow>
              <DetailRow label="LinkedIn">
                {candidate.linkedin_url ? (
                  <a
                    href={candidate.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 break-all text-sky-700 hover:text-sky-800"
                  >
                    <LinkedInIcon className="size-3.5 shrink-0" />
                    View profile
                  </a>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </DetailRow>
              <DetailRow label="Location">
                {candidate.location ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-slate-400" />
                    {candidate.location}
                  </span>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </DetailRow>
            </dl>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2 lg:order-1">
          <Card>
            <CardHeader
              title="Jobs & pipeline"
              description="A candidate can be considered for several jobs. Each one is an application with its own stage."
              action={
                <AssignDialog
                  mode="pick-job"
                  fixedId={candidate.id}
                  options={availableJobs.map((job) => ({
                    id: job.id,
                    label: job.title,
                  }))}
                  triggerLabel="Assign to job"
                  emptyMessage={
                    jobOptions.length === 0
                      ? "There are no jobs in this organization yet. Create one under Jobs first."
                      : "This candidate is already on every job in this organization."
                  }
                />
              }
            />
            {applications.length === 0 ? (
              <EmptyState
                icon={<Briefcase className="size-5" />}
                title="Not assigned to any job"
                description="Assign this candidate to a job to put them on the Kanban board."
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
                      title={application.job.title}
                      href={`/jobs/${application.job.id}`}
                      subtitle={`Added ${formatDate(application.createdAt)}`}
                      jobTitle={application.job.title}
                      showAvatar={false}
                      aiConfigured={aiConfigured}
                      hasCvText={hasCvText}
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

          <Card>
            <CardHeader
              title="CV"
              description={
                hasCvText
                  ? "Plain-text CV used by AI Match Analysis."
                  : "No CV text yet."
              }
              action={
                <LinkButton href={`/candidates/${candidate.id}/edit`} size="sm">
                  <FileText className="size-3.5" />
                  {hasCvText ? "Edit CV" : "Add CV"}
                </LinkButton>
              }
            />
            <div className="px-5 py-4">
              {hasCvText ? (
                <p className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-700 tf-scroll">
                  {candidate.cv_text}
                </p>
              ) : (
                <p className="text-sm text-slate-400">
                  Paste the candidate&apos;s CV as text to enable a useful AI
                  Match Analysis.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
