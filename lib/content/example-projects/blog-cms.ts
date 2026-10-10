import type { ExampleProjectInput } from "@/lib/domain/content";

export const blogCms: ExampleProjectInput = {
  id: "blog-cms",
  name: "Headless CMS and publication site (example)",
  category: "content",
  summary:
    "A headless CMS that stores drafts, revisions and schedules in Postgres and publishes them on a timer. A Next.js site renders the pages, a CDN caches them, and an image CDN resizes uploaded media.",
  scale: "30 editors; 2M page views/day; 95% CDN hit rate",
  focusConceptIds: [
    "caching",
    "conflict-resolution",
    "concurrency-control",
    "idempotency",
    "object-storage",
    "retries-and-backoff",
  ],
  relatedInvestigationIds: ["distributed-cache"],
  components: [
    {
      id: "editor",
      label: "CMS admin",
      kind: "client",
      responsibility: "Editor UI for drafts, previews, uploads and scheduling.",
    },
    {
      id: "reader",
      label: "Readers",
      kind: "client",
      responsibility: "Browsers that load articles and images.",
    },
    {
      id: "cdn",
      label: "CDN",
      kind: "edge",
      responsibility: "Caches rendered pages close to readers.",
    },
    {
      id: "site",
      label: "Next.js site",
      kind: "service",
      responsibility:
        "Renders article pages from published content and rebuilds them when revalidated.",
    },
    {
      id: "cms-api",
      label: "CMS API",
      kind: "service",
      responsibility: "Content CRUD, previews and publish requests.",
    },
    {
      id: "postgres",
      label: "Postgres",
      kind: "database",
      responsibility:
        "Documents, revision history, publish schedules and users.",
      durableState: "documents, revisions, schedules, users",
    },
    {
      id: "media",
      label: "Media storage",
      kind: "object-store",
      responsibility: "Stores the original uploaded images.",
      durableState: "original images",
    },
    {
      id: "images",
      label: "Image CDN",
      kind: "edge",
      responsibility: "Resizes originals on request and caches the results.",
    },
    {
      id: "scheduler",
      label: "Scheduler",
      kind: "worker",
      responsibility: "Publishes due posts and triggers page revalidation.",
    },
    {
      id: "search",
      label: "Hosted search",
      kind: "external",
      responsibility: "Full-text index of published posts.",
    },
  ],
  flows: [
    {
      id: "edit",
      from: "editor",
      to: "cms-api",
      label: "Save draft",
      kind: "request",
    },
    {
      id: "save",
      from: "cms-api",
      to: "postgres",
      label: "Write revision",
      kind: "request",
    },
    {
      id: "upload",
      from: "editor",
      to: "media",
      label: "Upload image",
      kind: "data",
    },
    {
      id: "publish",
      from: "cms-api",
      to: "scheduler",
      label: "Publish event",
      kind: "async",
    },
    {
      id: "due",
      from: "scheduler",
      to: "postgres",
      label: "Claim due posts",
      kind: "request",
    },
    {
      id: "revalidate",
      from: "scheduler",
      to: "site",
      label: "Revalidate paths",
      kind: "request",
    },
    {
      id: "index",
      from: "scheduler",
      to: "search",
      label: "Update index",
      kind: "request",
    },
    {
      id: "read",
      from: "reader",
      to: "cdn",
      label: "Read article",
      kind: "request",
    },
    {
      id: "origin",
      from: "cdn",
      to: "site",
      label: "Render on miss",
      kind: "request",
    },
    {
      id: "content",
      from: "site",
      to: "cms-api",
      label: "Fetch published content",
      kind: "request",
    },
    {
      id: "image",
      from: "reader",
      to: "images",
      label: "Load image",
      kind: "request",
    },
    {
      id: "image-origin",
      from: "images",
      to: "media",
      label: "Fetch original",
      kind: "data",
    },
  ],
  invariants: [
    {
      id: "no-lost-edits",
      statement: "One editor's save never silently overwrites another's",
      enforcedBy: ["cms-api", "postgres"],
      mechanism:
        "Optimistic concurrency: UPDATE … WHERE id = $1 AND revision = $2; zero rows shows a conflict.",
    },
    {
      id: "publish-once",
      statement: "A scheduled post is published once",
      enforcedBy: ["scheduler", "postgres"],
      mechanism:
        "Due rows claimed with FOR UPDATE SKIP LOCKED; publishing an already-published revision is a no-op.",
    },
    {
      id: "cache-follows-publish",
      statement: "Readers see a published change within a minute",
      enforcedBy: ["scheduler", "site"],
      mechanism:
        "Revalidation is sent after commit and retried with backoff; pages also expire after 10 minutes.",
    },
  ],
};
