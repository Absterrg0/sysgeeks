import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Keep private, generated, and non-page endpoints out of crawler queues. The public
// example gallery lives under /projects, so explicitly allow it below.
const PRIVATE = [
  "/account",
  "/api/",
  "/interview/session",
  "/projects/",
  "/reports/",
  "/sign-in",
  "/sign-up",
];
const PUBLIC_EXCEPTIONS = ["/projects/examples"];

/**
 * Search and AI answer engines are welcome everywhere public. They are named explicitly because
 * some site operators block them by default and a few crawlers only read their own group.
 */
const AI_CRAWLERS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
];

// Search and user-directed retrieval don't depend on these training crawlers. Keep the site's
// content discoverable in live answer engines without opting into model training by default.
const MODEL_TRAINING_CRAWLERS = ["GPTBot", "ClaudeBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", ...PUBLIC_EXCEPTIONS], disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: ["/", ...PUBLIC_EXCEPTIONS], disallow: PRIVATE },
      { userAgent: MODEL_TRAINING_CRAWLERS, disallow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
