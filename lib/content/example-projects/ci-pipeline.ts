import type { ExampleProjectInput } from "@/lib/domain/content";

export const ciPipeline: ExampleProjectInput = {
  id: "ci-pipeline",
  name: "Hosted CI service (example)",
  category: "devtools",
  summary:
    "A hosted CI service that runs a pipeline on every push. A webhook receiver records pipelines in Postgres, a scheduler expands them into job graphs, and ephemeral runner VMs lease jobs from a queue and stream logs to a live dashboard. Replace any part with how your own system works.",
  scale: "8k pipelines/hour; 600 concurrent runners",
  focusConceptIds: [
    "leases-and-fencing",
    "message-queues",
    "idempotency",
    "webhooks",
    "state-machines",
    "server-push",
    "retries-and-backoff",
    "timeouts",
  ],
  relatedInvestigationIds: ["job-queue"],
  components: [
    { id: "github", label: "GitHub", kind: "external", responsibility: "Sends push webhooks and receives commit statuses." },
    {
      id: "hooks",
      label: "Webhook receiver",
      kind: "service",
      responsibility: "Verifies push webhooks and records each new pipeline.",
    },
    {
      id: "ci-db",
      label: "Postgres",
      kind: "database",
      responsibility: "Stores pipelines, jobs, attempts and step status.",
      durableState: "pipelines, jobs, attempts, step status",
    },
    {
      id: "scheduler",
      label: "Scheduler",
      kind: "service",
      responsibility: "Expands pipelines into job graphs and enqueues jobs whose upstreams have succeeded.",
    },
    {
      id: "job-queue",
      label: "Job queue",
      kind: "queue",
      responsibility: "Holds pending jobs, grouped by runner label.",
      durableState: "pending jobs by runner label",
    },
    {
      id: "runners",
      label: "Runner VMs",
      kind: "worker",
      responsibility: "Ephemeral VMs that lease jobs, run their steps and report progress.",
    },
    {
      id: "log-stream",
      label: "Log stream",
      kind: "stream",
      responsibility: "Carries log lines from running jobs to the dashboard.",
      durableState: "live log lines, kept for 24 hours",
    },
    {
      id: "artifacts",
      label: "Artifact store",
      kind: "object-store",
      responsibility: "Archives finished job logs and build artifacts.",
      durableState: "archived logs and artifacts",
    },
    {
      id: "api",
      label: "Dashboard API",
      kind: "service",
      responsibility: "Serves pipeline views and the live log endpoint.",
    },
    { id: "ui", label: "Dashboard UI", kind: "client", responsibility: "Shows pipelines, jobs and live logs." },
    {
      id: "reporter",
      label: "Status reporter",
      kind: "worker",
      responsibility: "Posts commit statuses to GitHub when a pipeline's status changes.",
    },
  ],
  flows: [
    { id: "push", from: "github", to: "hooks", label: "Push webhook", kind: "async" },
    { id: "record", from: "hooks", to: "ci-db", label: "Create pipeline", kind: "request" },
    { id: "plan", from: "hooks", to: "scheduler", label: "Pipeline created", kind: "async" },
    { id: "enqueue", from: "scheduler", to: "job-queue", label: "Enqueue ready jobs", kind: "async" },
    { id: "lease", from: "runners", to: "job-queue", label: "Lease a job", kind: "request" },
    { id: "heartbeat", from: "runners", to: "ci-db", label: "Heartbeat and step status", kind: "request" },
    { id: "logs", from: "runners", to: "log-stream", label: "Stream log lines", kind: "async" },
    { id: "archive", from: "runners", to: "artifacts", label: "Upload logs and artifacts", kind: "data" },
    { id: "done", from: "runners", to: "scheduler", label: "Job finished", kind: "async" },
    { id: "view", from: "ui", to: "api", label: "Open pipeline", kind: "request" },
    { id: "tail", from: "api", to: "log-stream", label: "Tail logs", kind: "request" },
    { id: "live", from: "api", to: "ui", label: "Live logs (SSE)", kind: "push" },
    { id: "status", from: "scheduler", to: "reporter", label: "Status changed", kind: "async" },
    { id: "report", from: "reporter", to: "github", label: "Set commit status", kind: "request" },
  ],
  invariants: [
    {
      id: "one-runner-per-attempt",
      statement: "A job attempt is run by one runner at a time",
      enforcedBy: ["job-queue", "runners", "ci-db"],
      mechanism:
        "Lease with a visibility timeout renewed by heartbeats; the attempt number is a fencing token, and status writes are conditional UPDATEs with WHERE attempt = $n.",
    },
    {
      id: "deps-before-dependents",
      statement: "A job starts only after all its upstream jobs succeed",
      enforcedBy: ["scheduler", "ci-db"],
      mechanism:
        "On job completion the scheduler takes a row lock on the pipeline (SELECT ... FOR UPDATE) and enqueues only jobs whose upstreams have all succeeded.",
    },
    {
      id: "push-once",
      statement: "A redelivered webhook does not create a second pipeline",
      enforcedBy: ["hooks", "ci-db"],
      mechanism:
        "Unique constraint on the GitHub delivery id; the insert for a redelivery conflicts and creates nothing.",
    },
  ],
};
