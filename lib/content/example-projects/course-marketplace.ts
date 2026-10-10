import type { ExampleProjectInput } from "@/lib/domain/content";

export const courseMarketplace: ExampleProjectInput = {
  id: "course-marketplace",
  name: "Course marketplace (example)",
  category: "marketplace",
  summary:
    "Instructors upload video courses, students buy them, and instructors get monthly payouts. Built with Next.js, a Node API, Postgres, Stripe Connect, S3 with Mux for video, and Meilisearch for search. Replace any part with how your own system works.",
  scale: "40k students, 1,200 instructors, 5 purchases/min",
  focusConceptIds: [
    "idempotency",
    "transactional-outbox",
    "reconciliation",
    "object-storage",
    "webhooks",
    "asynchronous-processing",
  ],
  relatedInvestigationIds: ["payment-workflow", "video-processing-pipeline"],
  components: [
    {
      id: "web",
      label: "Next.js web app",
      kind: "client",
      responsibility: "Storefront for students and studio for instructors.",
    },
    {
      id: "api",
      label: "Node API",
      kind: "service",
      responsibility: "Catalog, checkout, enrolment and instructor endpoints.",
    },
    {
      id: "postgres",
      label: "Postgres",
      kind: "database",
      responsibility: "Source of truth for users, courses, orders, enrolments and payouts.",
      durableState: "users, courses, orders, enrolments, payouts",
    },
    {
      id: "search",
      label: "Meilisearch",
      kind: "database",
      responsibility: "Serves course search from an index derived from Postgres.",
      durableState: "derived course index, rebuildable",
    },
    {
      id: "stripe",
      label: "Stripe Connect",
      kind: "external",
      responsibility: "Checkout sessions, payment webhooks and transfers to instructors.",
    },
    {
      id: "videos",
      label: "S3 video storage",
      kind: "object-store",
      responsibility: "Stores raw uploads and transcoded renditions.",
      durableState: "raw uploads, renditions",
    },
    { id: "mux", label: "Mux", kind: "external", responsibility: "Transcodes uploaded videos and serves playback." },
    { id: "cdn", label: "CDN", kind: "edge", responsibility: "Serves images and video segments to students." },
    {
      id: "jobs",
      label: "Job queue",
      kind: "queue",
      responsibility: "Holds pending index, transcode and payout jobs in pg-boss.",
      durableState: "pending jobs",
    },
    {
      id: "worker",
      label: "Course worker",
      kind: "worker",
      responsibility: "Reindexes courses, starts transcodes and runs monthly payout batches.",
    },
  ],
  flows: [
    { id: "browse", from: "web", to: "api", label: "Browse and buy", kind: "request" },
    { id: "query", from: "api", to: "search", label: "Search courses", kind: "request" },
    { id: "checkout", from: "api", to: "stripe", label: "Create checkout", kind: "request" },
    { id: "paid", from: "stripe", to: "api", label: "Payment webhooks", kind: "async" },
    { id: "write", from: "api", to: "postgres", label: "Write orders and enrolments", kind: "request" },
    { id: "upload", from: "web", to: "videos", label: "Upload via presigned URL", kind: "data" },
    { id: "enqueue", from: "api", to: "jobs", label: "Enqueue index, transcode and payout", kind: "async" },
    { id: "claim", from: "worker", to: "jobs", label: "Claim jobs", kind: "request" },
    { id: "transcode", from: "worker", to: "mux", label: "Start transcode", kind: "request" },
    { id: "transcoded", from: "mux", to: "api", label: "Asset ready webhook", kind: "async" },
    { id: "index", from: "worker", to: "search", label: "Reindex course", kind: "request" },
    { id: "payout", from: "worker", to: "stripe", label: "Monthly transfers", kind: "request" },
    { id: "watch", from: "web", to: "cdn", label: "Stream lessons", kind: "request" },
  ],
  invariants: [
    {
      id: "enrol-after-payment",
      statement: "A student is enrolled only after payment succeeds",
      enforcedBy: ["api", "postgres"],
      mechanism:
        "Enrolment inserted in the transaction that marks the order paid, run only from the verified webhook; unique (order_id) makes redelivery a no-op.",
    },
    {
      id: "payout-once",
      statement: "Each instructor is paid once per period",
      enforcedBy: ["worker", "postgres"],
      mechanism: "payouts unique (instructor_id, period); the Stripe transfer uses idempotency key = payout id.",
    },
    {
      id: "search-converges",
      statement: "Search results converge to the database",
      enforcedBy: ["worker", "search"],
      mechanism:
        "Course changes write an outbox row; the worker reindexes from it; a nightly full reindex repairs drift.",
    },
  ],
};
