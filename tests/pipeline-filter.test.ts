import { describe, expect, it } from "vitest";

import type { BoardApplication } from "@/types/ats";
import {
  ALL_JOBS,
  DEFAULT_FILTERS,
  filterApplications,
  groupByStage,
} from "@/lib/pipeline/filter";
import type { PipelineStage } from "@/types/database";

const JOB_BACKEND = "job-backend";
const JOB_FRONTEND = "job-frontend";

function application(
  id: string,
  name: string,
  jobId: string,
  stage: PipelineStage,
): BoardApplication {
  return {
    id,
    stage,
    notes: null,
    createdAt: "2026-10-01T10:00:00.000Z",
    candidate: {
      id: `candidate-${id}`,
      full_name: name,
      email: `${name.split(" ")[0].toLowerCase()}@example.com`,
      linkedin_url: null,
      location: "Stockholm",
      hasCvText: true,
    },
    job: {
      id: jobId,
      title: jobId === JOB_BACKEND ? "Backend Developer" : "Frontend Developer",
    },
  };
}

const applications: BoardApplication[] = [
  application("1", "Anna Andersson", JOB_BACKEND, "new"),
  application("2", "Erik Lindqvist", JOB_BACKEND, "screening"),
  application("3", "Sofia Bergström", JOB_FRONTEND, "interview"),
  application("4", "Johan Nilsson", JOB_FRONTEND, "offer"),
  application("5", "Maria Sandberg", JOB_BACKEND, "hired"),
  application("6", "Oscar Hult", JOB_FRONTEND, "rejected"),
];

describe("filterApplications", () => {
  it("hides rejected applications by default", () => {
    const result = filterApplications(applications, DEFAULT_FILTERS);
    expect(result).toHaveLength(5);
    expect(result.some((item) => item.stage === "rejected")).toBe(false);
  });

  it("includes rejected when asked", () => {
    const result = filterApplications(applications, {
      ...DEFAULT_FILTERS,
      showRejected: true,
    });
    expect(result).toHaveLength(6);
  });

  it("filters by job", () => {
    const result = filterApplications(applications, {
      ...DEFAULT_FILTERS,
      jobId: JOB_BACKEND,
    });
    expect(result.map((item) => item.id)).toEqual(["1", "2", "5"]);
  });

  it("returns everything for the All Jobs option", () => {
    const result = filterApplications(applications, {
      ...DEFAULT_FILTERS,
      jobId: ALL_JOBS,
      showRejected: true,
    });
    expect(result).toHaveLength(6);
  });

  it("matches candidate names case-insensitively on a partial string", () => {
    expect(
      filterApplications(applications, { ...DEFAULT_FILTERS, query: "anna" }).map(
        (item) => item.candidate.full_name,
      ),
    ).toEqual(["Anna Andersson"]);

    // "berg" is a substring of both Bergström and Sandberg - partial matching
    // anywhere in the name is the intended behaviour, not a prefix match.
    expect(
      filterApplications(applications, { ...DEFAULT_FILTERS, query: "BERG" })
        .map((item) => item.candidate.full_name)
        .sort(),
    ).toEqual(["Maria Sandberg", "Sofia Bergström"]);
  });

  it("matches on a surname fragment, not just the start of the name", () => {
    expect(
      filterApplications(applications, { ...DEFAULT_FILTERS, query: "nilsson" }),
    ).toHaveLength(1);
  });

  it("ignores surrounding whitespace in the search term", () => {
    expect(
      filterApplications(applications, { ...DEFAULT_FILTERS, query: "   erik  " }),
    ).toHaveLength(1);
  });

  it("combines the job filter and the name search", () => {
    // "Anna" exists, but not on the frontend job.
    expect(
      filterApplications(applications, {
        ...DEFAULT_FILTERS,
        jobId: JOB_FRONTEND,
        query: "anna",
      }),
    ).toHaveLength(0);
  });

  it("returns an empty list rather than everything when nothing matches", () => {
    expect(
      filterApplications(applications, { ...DEFAULT_FILTERS, query: "zzzz" }),
    ).toHaveLength(0);
  });

  it("does not mutate the input array", () => {
    const copy = [...applications];
    filterApplications(applications, { ...DEFAULT_FILTERS, query: "anna" });
    expect(applications).toEqual(copy);
  });
});

describe("groupByStage", () => {
  it("creates an entry for every stage, including the empty ones", () => {
    const groups = groupByStage([]);
    expect(Object.keys(groups).sort()).toEqual(
      ["hired", "interview", "new", "offer", "rejected", "screening"].sort(),
    );
    expect(Object.values(groups).every((list) => list.length === 0)).toBe(true);
  });

  it("puts each application in its own stage", () => {
    const groups = groupByStage(applications);
    expect(groups.new.map((item) => item.id)).toEqual(["1"]);
    expect(groups.screening.map((item) => item.id)).toEqual(["2"]);
    expect(groups.interview.map((item) => item.id)).toEqual(["3"]);
    expect(groups.offer.map((item) => item.id)).toEqual(["4"]);
    expect(groups.hired.map((item) => item.id)).toEqual(["5"]);
    expect(groups.rejected.map((item) => item.id)).toEqual(["6"]);
  });

  it("groups the filtered set, so a hidden stage stays empty", () => {
    const visible = filterApplications(applications, DEFAULT_FILTERS);
    expect(groupByStage(visible).rejected).toHaveLength(0);
  });
});
