import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const TITLE_SUFFIX = ` · ${SITE_NAME}`;

/**
 * Title, description, canonical URL and social-card text for one page.
 * Pages set `openGraph` explicitly because Next.js does not derive it from `title`;
 * the card image itself comes from the nearest `opengraph-image` file.
 */
export function pageMetadata({
  title,
  description,
  path,
  noindex = false,
}: {
  title: string;
  description: string;
  /** Path from the site root, e.g. "/concepts/idempotency". */
  path: string;
  /** For pages that only show the visitor's own browser data: followed, never listed. */
  noindex?: boolean;
}): Metadata {
  const absoluteTitle = title.length > 68 ? clip(title, 68) : title;
  return {
    // Keep title text concise enough that the important words fit after HTML escaping and result decoration.
    title: `${title}${TITLE_SUFFIX}`.length > 55 ? { absolute: absoluteTitle } : title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: SITE_NAME, type: "website", locale: "en_US" },
    twitter: { card: "summary_large_image", title, description },
    ...(noindex && { robots: { index: false, follow: true } }),
  };
}

/** A `<script type="application/ld+json">` payload, escaped so content cannot close the tag. */
export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c");
}

/** A schema.org BreadcrumbList, which search results show in place of the bare URL. */
export function breadcrumbs(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

/** A schema.org ItemList of pages, for index pages: tells engines what the collection contains and in what order. */
export function itemList(name: string, items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: `${SITE_URL}${item.path}`,
    })),
  };
}

/** Plain text cut at a word boundary, for meta descriptions that should not be truncated mid-word. */
export function clip(text: string, max = 158): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:.—-]+$/, "")}…`;
}

/** A compact system name for titles that pair a long stage prompt with its system. */
export function systemNameForTitle(searchTitle: string): string {
  return searchTitle
    .replace(/^Design\s+(?:(?:a|an|the)\s+)?/i, "")
    .replace(/^Shard a /i, "")
    .replace(/ Without Downtime$/i, "")
    .replace(/\s*\([^)]*\)/g, "")
    .trim();
}

/**
 * A schema.org FAQPage. Every question and answer must also be visible on the page;
 * answer engines quote these pairs, and Google ignores markup that the page does not show.
 */
export function faqPage(items: { question: string; answer: string }[]): Record<string, unknown> {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
