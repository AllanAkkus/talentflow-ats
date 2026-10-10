import type { EmploymentType, JobStatus, PipelineStage } from "../src/types/database";

/**
 * Fictional demo data.
 *
 * Everything here is invented: names, emails, phone numbers, LinkedIn URLs and
 * CVs. No real person's data is used anywhere in this repository.
 *
 * Two organizations exist on purpose. Northstar is the showcase tenant with a
 * full pipeline; Lumen Health is the second tenant used to demonstrate - and
 * manually verify - that tenant isolation actually holds.
 */

export type SeedJob = {
  key: string;
  title: string;
  status: JobStatus;
  location: string;
  employmentType: EmploymentType;
  description: string;
};

export type SeedCandidate = {
  key: string;
  fullName: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  location: string;
  cvText: string;
};

export type SeedApplication = {
  candidateKey: string;
  jobKey: string;
  stage: PipelineStage;
  notes?: string;
};

export type SeedOrganization = {
  name: string;
  users: { email: string; fullName: string }[];
  jobs: SeedJob[];
  candidates: SeedCandidate[];
  applications: SeedApplication[];
};

const NORTHSTAR_JOBS: SeedJob[] = [
  {
    key: "backend",
    title: "Backend Developer",
    status: "open",
    location: "Stockholm (hybrid)",
    employmentType: "full_time",
    description: `Northstar Consulting is looking for a Backend Developer to join the platform team of four engineers.

What you will work on
- Design and build REST and event-driven services in Node.js and TypeScript
- Model and tune PostgreSQL schemas, including migrations and query performance
- Own services end to end: CI/CD, observability, on-call during business hours

Requirements
- 3+ years building production backend services
- Strong TypeScript or another statically typed language
- Solid relational database skills (PostgreSQL preferred): indexing, transactions, query plans
- Experience with containers and a cloud provider (AWS, GCP or Azure)
- Comfortable writing automated tests

Nice to have
- Experience with multi-tenant SaaS and row-level authorization
- Message queues (SQS, Kafka, RabbitMQ)
- Infrastructure as code (Terraform)`,
  },
  {
    key: "frontend",
    title: "Frontend Developer",
    status: "open",
    location: "Stockholm (hybrid)",
    employmentType: "full_time",
    description: `We are hiring a Frontend Developer to build the customer-facing web app alongside a designer and two backend engineers.

What you will work on
- Build and maintain the React application (React 19, Next.js App Router, TypeScript)
- Turn Figma designs into accessible, responsive components
- Improve Core Web Vitals and the overall perceived speed of the product

Requirements
- 2+ years of professional React work
- Strong TypeScript, CSS and layout fundamentals
- Practical accessibility knowledge (keyboard navigation, ARIA, contrast)
- Experience consuming REST or GraphQL APIs

Nice to have
- Next.js App Router and Server Components
- Tailwind CSS
- Design-system or component-library work
- Playwright or Cypress end-to-end testing`,
  },
  {
    key: "designer",
    title: "Product Designer",
    status: "open",
    location: "Stockholm / remote within EU",
    employmentType: "full_time",
    description: `Product Designer for our B2B SaaS products, working directly with the product lead and the engineering team.

What you will work on
- Own end-to-end design: discovery, flows, wireframes, high-fidelity UI, hand-off
- Run user interviews and usability tests with recruiters and hiring managers
- Grow and document our design system

Requirements
- 3+ years designing B2B or data-heavy product interfaces
- A portfolio that shows problem framing, not just final screens
- Fluent in Figma, including components and auto-layout
- Able to work closely with engineers and reason about feasibility

Nice to have
- Experience designing dashboards, tables and pipeline/Kanban interfaces
- Basic HTML/CSS literacy
- Accessibility (WCAG) experience`,
  },
];

const NORTHSTAR_CANDIDATES: SeedCandidate[] = [
  {
    key: "anna",
    fullName: "Anna Andersson",
    email: "anna.andersson@example.com",
    phone: "+46 70 111 22 33",
    linkedinUrl: "https://www.linkedin.com/in/example-anna-andersson",
    location: "Stockholm, Sweden",
    cvText: `Anna Andersson - Senior Backend Developer
Stockholm, Sweden

SUMMARY
Backend engineer with 7 years of experience building multi-tenant SaaS platforms in TypeScript and Node.js. Comfortable owning a service from schema design to production on-call.

EXPERIENCE
Senior Backend Developer, Kvasir Platform AB (2021-present)
- Led the migration of a single-tenant billing service to a multi-tenant model using PostgreSQL row-level security; reduced per-customer infrastructure cost by about 40%.
- Designed the event pipeline (SQS + Lambda) that processes roughly 2 million usage events per day.
- Reduced p95 API latency from 820 ms to 180 ms by rewriting the three worst N+1 query paths and adding partial indexes.
- Mentored two junior engineers and introduced trunk-based development with required CI checks.

Backend Developer, Fjord Analytics (2018-2021)
- Built REST APIs in Node.js/Express and later Fastify for a reporting product with 300+ B2B customers.
- Introduced database migrations and a seeded test database, cutting release-related incidents noticeably.
- Wrote the Terraform modules for the team's AWS footprint (ECS, RDS, ALB).

SKILLS
TypeScript, Node.js, Fastify, PostgreSQL, Prisma, Redis, AWS (ECS, RDS, SQS, Lambda), Docker, Terraform, GitHub Actions, Vitest, OpenTelemetry

EDUCATION
MSc Computer Science, KTH Royal Institute of Technology (2018)`,
  },
  {
    key: "erik",
    fullName: "Erik Lindqvist",
    email: "erik.lindqvist@example.com",
    phone: "+46 70 222 33 44",
    linkedinUrl: "https://www.linkedin.com/in/example-erik-lindqvist",
    location: "Uppsala, Sweden",
    cvText: `Erik Lindqvist - Backend Developer
Uppsala, Sweden

SUMMARY
Backend developer with 4 years of experience, mostly in Python with a recent move into TypeScript. Strong on data modelling and testing.

EXPERIENCE
Backend Developer, Nordkraft Energi (2022-present)
- Built internal APIs in Python (FastAPI) and PostgreSQL for meter-data ingestion.
- Introduced pytest-based integration tests against a dockerised PostgreSQL; coverage went from 20% to 75%.
- Took part in the team's rotation for production support.

Developer, Uppsala Datakonsult (2020-2022)
- Maintained a Django monolith for a logistics customer.
- Added Celery-based background processing for nightly batch jobs.

SKILLS
Python, FastAPI, Django, PostgreSQL, SQLAlchemy, Docker, pytest, Git, some TypeScript and Node.js (side projects), GCP (Cloud Run, Cloud SQL)

EDUCATION
BSc Information Systems, Uppsala University (2020)`,
  },
  {
    key: "sofia",
    fullName: "Sofia Bergström",
    email: "sofia.bergstrom@example.com",
    phone: "+46 70 333 44 55",
    linkedinUrl: "https://www.linkedin.com/in/example-sofia-bergstrom",
    location: "Gothenburg, Sweden",
    cvText: `Sofia Bergström - Frontend Developer
Gothenburg, Sweden

SUMMARY
Frontend developer with 5 years in React, the last two focused on Next.js App Router and design systems. Accessibility advocate.

EXPERIENCE
Frontend Developer, Lumera Retail Tech (2021-present)
- Rebuilt the merchant dashboard in Next.js 14/15 App Router with React Server Components; LCP improved from 4.1 s to 1.6 s.
- Owns the internal component library (40+ components) built on Tailwind CSS and Radix primitives.
- Drove the WCAG 2.1 AA audit remediation: full keyboard support, focus management and contrast fixes across the app.
- Set up Playwright end-to-end tests covering the five critical merchant flows.

Frontend Developer, Studio Vast (2019-2021)
- Built React SPAs for agency clients, mostly with Create React App and Redux.
- Introduced Storybook and visual regression checks.

SKILLS
TypeScript, React 19, Next.js (App Router), Tailwind CSS, CSS architecture, Radix UI, Playwright, Vitest, Figma hand-off, WCAG 2.1, REST and GraphQL

EDUCATION
BSc Interaction Design, Chalmers University of Technology (2019)`,
  },
  {
    key: "johan",
    fullName: "Johan Nilsson",
    email: "johan.nilsson@example.com",
    phone: "+46 70 444 55 66",
    linkedinUrl: "https://www.linkedin.com/in/example-johan-nilsson",
    location: "Malmö, Sweden",
    cvText: `Johan Nilsson - Fullstack Developer
Malmö, Sweden

SUMMARY
Fullstack developer, 6 years. Started in frontend, now equally comfortable in Node.js backends. Has shipped two products from zero to first paying customers.

EXPERIENCE
Fullstack Developer, Tinnitus Labs (2022-present)
- First engineer on a new B2B product: Next.js frontend, Node.js API, PostgreSQL.
- Built the role-based permission model and the audit log.
- Set up the CI/CD pipeline on Vercel and Fly.io.

Frontend Developer, Mellanrum AB (2019-2022)
- React and TypeScript work on a booking platform used by about 200 clinics.
- Converted the legacy jQuery admin to React incrementally.

SKILLS
TypeScript, React, Next.js, Node.js, PostgreSQL, Tailwind CSS, Stripe, Vercel, Docker, Jest

EDUCATION
BSc Computer Science, Lund University (2019)`,
  },
  {
    key: "maria",
    fullName: "Maria Sandberg",
    email: "maria.sandberg@example.com",
    phone: "+46 70 555 66 77",
    linkedinUrl: "https://www.linkedin.com/in/example-maria-sandberg",
    location: "Stockholm, Sweden",
    cvText: `Maria Sandberg - Product Designer
Stockholm, Sweden

SUMMARY
Product designer with 8 years of experience, specialised in data-heavy B2B interfaces: dashboards, tables, pipelines and admin tooling.

EXPERIENCE
Senior Product Designer, Atlas HR Suite (2020-present)
- Owned the end-to-end redesign of the applicant tracking module: discovery interviews with 18 recruiters, new pipeline/Kanban model, phased rollout. Time-to-first-hire reporting adoption went from 12% to 58%.
- Built and documented the design system in Figma (tokens, components, usage guidance) used by three product teams.
- Ran a quarterly usability-testing cadence; wrote the research repository the team still uses.

Product Designer, Veritas Fintech (2017-2020)
- Designed the compliance review workflow for a regulated lending product.
- Worked daily with engineers on feasibility and progressive disclosure of complex forms.

SKILLS
Figma (components, auto-layout, variables), interaction design, user interviews, usability testing, design systems, WCAG 2.1, basic HTML/CSS, Maze, Dovetail

EDUCATION
MA Design, Konstfack (2017)`,
  },
  {
    key: "oscar",
    fullName: "Oscar Hult",
    email: "oscar.hult@example.com",
    phone: "+46 70 666 77 88",
    linkedinUrl: "https://www.linkedin.com/in/example-oscar-hult",
    location: "Remote, Portugal",
    cvText: `Oscar Hult - Frontend Developer
Remote (Lisbon, Portugal)

SUMMARY
Frontend developer with 3 years of experience in React and Vue. Looking for a remote-first role.

EXPERIENCE
Frontend Developer, Wavelet Studio (2022-present)
- Vue 3 and Nuxt work on a marketing-site builder.
- Built the drag-and-drop block editor used by about 5000 end users.

Junior Frontend Developer, Kodhuset (2021-2022)
- React and JavaScript maintenance work on an e-commerce theme.

SKILLS
JavaScript, TypeScript (intermediate), Vue 3, Nuxt, React (intermediate), CSS, Vite, Cypress

EDUCATION
Vocational diploma, Frontend Development, Nackademin (2021)`,
  },
  {
    key: "fatima",
    fullName: "Fatima Haddad",
    email: "fatima.haddad@example.com",
    phone: "+46 70 777 88 99",
    linkedinUrl: "https://www.linkedin.com/in/example-fatima-haddad",
    location: "Stockholm, Sweden",
    cvText: `Fatima Haddad - Platform Engineer
Stockholm, Sweden

SUMMARY
Platform engineer with 5 years of experience bridging backend and infrastructure. Strong PostgreSQL and observability background.

EXPERIENCE
Platform Engineer, Hedvig Infra (2021-present)
- Runs the PostgreSQL fleet (18 instances): upgrades, connection pooling with PgBouncer, backup and restore drills.
- Introduced row-level security to a shared-schema multi-tenant product and wrote the policy test suite.
- Built the OpenTelemetry pipeline feeding Grafana dashboards and SLO alerting.

Backend Developer, Sigma Systems (2019-2021)
- Node.js and TypeScript services behind a payments integration.
- Wrote the migration tooling the team used for three years.

SKILLS
PostgreSQL (RLS, indexing, EXPLAIN), TypeScript, Node.js, Go (basic), Kubernetes, Terraform, Grafana, Prometheus, OpenTelemetry, AWS

EDUCATION
MSc Computer Engineering, Linköping University (2019)`,
  },
  {
    key: "daniel",
    fullName: "Daniel Okoye",
    email: "daniel.okoye@example.com",
    phone: "+46 70 888 99 00",
    linkedinUrl: "https://www.linkedin.com/in/example-daniel-okoye",
    location: "Copenhagen, Denmark",
    cvText: `Daniel Okoye - UX/Product Designer
Copenhagen, Denmark

SUMMARY
Designer with 4 years of experience, mostly consumer mobile, now moving towards B2B product work.

EXPERIENCE
Product Designer, Nordlys Mobile (2022-present)
- Designed onboarding and subscription flows for a consumer fitness app (400k MAU).
- Ran A/B tests on paywall variants with the growth team.

UX Designer, Frame Agency (2020-2022)
- Client work: mobile apps and marketing sites, mostly in Figma and Sketch.

SKILLS
Figma, Sketch, prototyping, A/B testing, consumer onboarding, design systems (contributor), basic HTML/CSS

EDUCATION
BA Digital Design, KEA Copenhagen (2020)`,
  },
];

const NORTHSTAR_APPLICATIONS: SeedApplication[] = [
  // Backend Developer - a full funnel.
  { candidateKey: "anna", jobKey: "backend", stage: "offer", notes: "Strongest backend profile so far. Offer sent 2026-10-06, verbal yes pending written acceptance." },
  { candidateKey: "fatima", jobKey: "backend", stage: "interview", notes: "Technical interview booked. Very strong PostgreSQL and RLS background." },
  { candidateKey: "erik", jobKey: "backend", stage: "screening", notes: "Mostly Python; wants to move to TypeScript. 20-minute intro call done." },
  { candidateKey: "johan", jobKey: "backend", stage: "new", notes: "Applied via the careers page." },
  { candidateKey: "oscar", jobKey: "backend", stage: "rejected", notes: "Frontend-weighted profile, not enough backend depth for this role." },

  // Frontend Developer.
  { candidateKey: "sofia", jobKey: "frontend", stage: "hired", notes: "Signed. Starts 2026-11-03." },
  { candidateKey: "johan", jobKey: "frontend", stage: "interview", notes: "Same candidate as on Backend Developer - deliberately in two pipelines." },
  { candidateKey: "oscar", jobKey: "frontend", stage: "screening", notes: "Remote from Portugal; needs an EU-remote contract." },

  // Product Designer.
  { candidateKey: "maria", jobKey: "designer", stage: "offer", notes: "Portfolio review excellent. Compensation discussion in progress." },
  { candidateKey: "daniel", jobKey: "designer", stage: "screening", notes: "Consumer background, less B2B. Portfolio call booked." },
];

const LUMEN_JOBS: SeedJob[] = [
  {
    key: "nurse",
    title: "Clinical Operations Lead",
    status: "open",
    location: "Lund, Sweden",
    employmentType: "full_time",
    description: `Lumen Health is hiring a Clinical Operations Lead to run day-to-day operations across three outpatient clinics.

Requirements
- Registered nurse or equivalent clinical qualification
- 5+ years of clinical experience, at least 2 in a coordinating or lead role
- Experience with clinical quality systems and incident reporting
- Fluent Swedish and English

Nice to have
- Experience introducing a new patient-record system
- Lean or similar process-improvement training`,
  },
  {
    key: "datanalyst",
    title: "Health Data Analyst",
    status: "draft",
    location: "Lund, Sweden",
    employmentType: "part_time",
    description: `Part-time Health Data Analyst to support quality reporting.

Requirements
- SQL and a reporting tool (Power BI or similar)
- Comfortable working with sensitive data under GDPR
- Degree in statistics, epidemiology, data science or similar`,
  },
];

const LUMEN_CANDIDATES: SeedCandidate[] = [
  {
    key: "karin",
    fullName: "Karin Holm",
    email: "karin.holm@example.com",
    phone: "+46 70 121 31 41",
    linkedinUrl: "https://www.linkedin.com/in/example-karin-holm",
    location: "Lund, Sweden",
    cvText: `Karin Holm - Registered Nurse / Clinical Coordinator
Lund, Sweden

EXPERIENCE
Clinical Coordinator, Skåne Primary Care (2020-present)
- Coordinates staffing and patient flow across two clinics, 38 staff in total.
- Led the rollout of a new incident-reporting process; reporting rate tripled in 12 months.

Registered Nurse, Lund University Hospital (2014-2020)
- Acute internal medicine ward.

SKILLS
Clinical operations, staffing and scheduling, quality systems, incident reporting, Lean healthcare (certified), Swedish and English

EDUCATION
BSc Nursing, Lund University (2014)`,
  },
  {
    key: "petter",
    fullName: "Petter Ek",
    email: "petter.ek@example.com",
    phone: "+46 70 151 61 71",
    linkedinUrl: "https://www.linkedin.com/in/example-petter-ek",
    location: "Malmö, Sweden",
    cvText: `Petter Ek - Data Analyst
Malmö, Sweden

EXPERIENCE
Data Analyst, Region Skåne (2021-present)
- Quality and waiting-time reporting in SQL and Power BI.
- Built the dashboard used in monthly clinic review meetings.

Junior Analyst, Statistikbyran (2019-2021)
- Survey data processing in R.

SKILLS
SQL, Power BI, R, Python (pandas), GDPR-aware data handling, epidemiological basics

EDUCATION
MSc Statistics, Lund University (2019)`,
  },
  {
    key: "ingrid",
    fullName: "Ingrid Vikström",
    email: "ingrid.vikstrom@example.com",
    phone: "+46 70 181 91 01",
    linkedinUrl: "https://www.linkedin.com/in/example-ingrid-vikstrom",
    location: "Helsingborg, Sweden",
    cvText: `Ingrid Vikström - Nurse Manager
Helsingborg, Sweden

EXPERIENCE
Nurse Manager, Vårdcentralen Norr (2018-present)
- Line manager for 22 staff. Budget responsibility.
- Introduced a new patient-record system across the clinic.

Registered Nurse (2012-2018)
- Paediatric outpatient care.

SKILLS
People management, budgeting, clinical quality, change management, Swedish and English

EDUCATION
BSc Nursing, Malmö University (2012); Healthcare management diploma (2019)`,
  },
];

const LUMEN_APPLICATIONS: SeedApplication[] = [
  { candidateKey: "karin", jobKey: "nurse", stage: "interview", notes: "Strong operational background. Second interview with the clinic director booked." },
  { candidateKey: "ingrid", jobKey: "nurse", stage: "screening", notes: "Management experience, slightly less coordination-specific." },
  { candidateKey: "petter", jobKey: "datanalyst", stage: "new", notes: "Role is still a draft - keeping the candidate warm." },
];

export const SEED_ORGANIZATIONS: SeedOrganization[] = [
  {
    name: "Northstar Consulting AB",
    users: [
      { email: "anna@northstar.example.com", fullName: "Anna Ek" },
      { email: "marcus@northstar.example.com", fullName: "Marcus Dahl" },
    ],
    jobs: NORTHSTAR_JOBS,
    candidates: NORTHSTAR_CANDIDATES,
    applications: NORTHSTAR_APPLICATIONS,
  },
  {
    name: "Lumen Health AB",
    users: [{ email: "lisa@lumenhealth.example.com", fullName: "Lisa Berg" }],
    jobs: LUMEN_JOBS,
    candidates: LUMEN_CANDIDATES,
    applications: LUMEN_APPLICATIONS,
  },
];
