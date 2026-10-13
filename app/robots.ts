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
  "Claude-SearchBot",
  "PerplexityBot",
  "Applebot",
  "Amzn-SearchBot",
];

// These agents fetch pages only when an individual user asks an assistant to visit a URL.
// Keep them separate from automatic search indexing and training crawlers.
const USER_REQUESTED_FETCHERS = [
  "ChatGPT-User",
  "Claude-User",
  "Perplexity-User",
  "Amzn-User",
];

// These tokens control model-training or corpus access rather than web search. Keep live search
// eligibility separate; Google Search AI inclusion is managed in Search Console.
const TRAINING_AND_CORPUS_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Meta-ExternalAgent",
  "Amazonbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", ...PUBLIC_EXCEPTIONS], disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: ["/", ...PUBLIC_EXCEPTIONS], disallow: PRIVATE },
      { userAgent: USER_REQUESTED_FETCHERS, disallow: "/" },
      { userAgent: TRAINING_AND_CORPUS_CRAWLERS, disallow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
