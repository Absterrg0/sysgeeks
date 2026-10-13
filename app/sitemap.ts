import type { MetadataRoute } from "next";
import { listCompanies, listConcepts, listInvestigations } from "@/lib/content";
import { listExampleProjects } from "@/lib/content/example-projects";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const investigations = listInvestigations();
  const updatedInvestigationReviews = investigations
    .filter((investigation) => investigation.answerSummary)
    .map(({ id }) => [
      `/investigations/${id}/review`,
      id === "shard-live-database" ? "2026-10-14" : "2026-10-13",
    ] as const);
  // Only include dates for pages with a known material edit. Avoid refreshing every
  // URL on each deploy, which would make the sitemap's update hints unreliable.
  const lastModified: Record<string, string> = {
    "/": "2026-10-13",
    "/system-design-interview": "2026-10-13",
    "/system-design-interview/failure-scenarios": "2026-10-12",
    "/system-design-interview/drills": "2026-10-13",
    "/system-design-interview/ai-system-design": "2026-10-11",
    "/system-design-interview/worksheet": "2026-10-11",
    "/investigations": "2026-10-13",
    "/concepts": "2026-10-13",
    "/concepts/rate-limiting": "2026-10-13",
    "/companies": "2026-10-12",
    "/companies/dropbox": "2026-10-12",
    "/concepts/object-storage": "2026-10-12",
    "/concepts/transactions": "2026-10-12",
    "/concepts/idempotency": "2026-10-12",
    "/concepts/partitioning": "2026-10-12",
    "/concepts/asynchronous-processing": "2026-10-12",
    "/concepts/replication": "2026-10-12",
    "/concepts/concurrency-control": "2026-10-12",
    "/system-design-mock-interview": "2026-10-12",
    "/system-design-playground": "2026-10-14",
    "/investigations/shard-live-database": "2026-10-14",
    "/projects/examples": "2026-10-14",
    "/downloads/system-design-interview-questions-and-answers.pdf": "2026-10-13",
    "/capacity-estimator": "2026-10-11",
    "/concepts/server-push": "2026-10-11",
    "/system-design-interview/design-llm-inference": "2026-10-11",
    "/system-design-interview/design-rag-system": "2026-10-13",
    "/system-design-interview/llm-inference-capacity": "2026-10-11",
    "/system-design-interview/design-instagram-feed": "2026-10-12",
    "/system-design-interview/design-whatsapp": "2026-10-13",
    "/system-design-interview/design-search-autocomplete": "2026-10-13",
    "/companies/google": "2026-10-11",
    "/companies/amazon": "2026-10-11",
    "/companies/uber": "2026-10-11",
    ...Object.fromEntries(updatedInvestigationReviews),
  };
  const paths = [
    "/",
    "/system-design-interview",
    "/system-design-interview/failure-scenarios",
    "/system-design-interview/drills",
    "/system-design-interview/ai-system-design",
    "/system-design-interview/worksheet",
    "/downloads/system-design-interview-practice-sheet.pdf",
    "/downloads/system-design-interview-questions-and-answers.pdf",
    "/system-design-interview/scorecard",
    "/downloads/system-design-interview-scorecard.pdf",
    "/system-design-interview/design-youtube",
    "/system-design-interview/design-instagram-feed",
    "/system-design-interview/design-whatsapp",
    "/system-design-interview/design-llm-inference",
    "/system-design-interview/llm-inference-capacity",
    "/system-design-interview/design-rag-system",
    "/system-design-interview/design-ai-agent",
    "/system-design-interview/design-search-autocomplete",
    "/system-design-mock-interview",
    "/system-design-playground",
    "/capacity-estimator",
    "/investigations",
    "/concepts",
    "/companies",
    "/review",
    "/about",
    "/ai",
    // The exercise entry page and its complete walkthrough answer different search
    // intents; both are canonical, standalone pages. Individual decision stages and
    // tool-only modes remain linked and crawlable without being listed here.
    ...investigations.map(({ id }) => `/investigations/${id}`),
    ...investigations.map((inv) => `/investigations/${inv.id}/review`),
    ...listConcepts().map((c) => `/concepts/${c.id}`),
    ...listCompanies().map((c) => `/companies/${c.id}`),
    "/projects/examples",
    ...listExampleProjects().map((e) => `/projects/examples/${e.id}`),
  ];
  return paths.map((path) => ({
    url: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
    ...(lastModified[path] ? { lastModified: lastModified[path] } : {}),
  }));
}
