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
  imagePath = "/opengraph-image",
  noindex = false,
}: {
  title: string;
  description: string;
  /** Path from the site root, e.g. "/concepts/idempotency". */
  path: string;
  /** Path to this page's generated card image. Defaults to the site-wide image. */
  imagePath?: string;
  /** For pages that only show the visitor's own browser data: followed, never listed. */
  noindex?: boolean;
}): Metadata {
  const absoluteTitle = title.length > 68 ? clip(title, 68) : title;
  const metaDescription = clipDescription(description);
  const imageUrl = `${SITE_URL}${imagePath}`;
  return {
    // Keep title text concise enough that the important words fit after HTML escaping and result decoration.
    title: `${title}${TITLE_SUFFIX}`.length > 55 ? { absolute: absoluteTitle } : title,
    description: metaDescription,
    alternates: { canonical: path },
    openGraph: {
      title,
      description: metaDescription,
      url: path,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description: metaDescription, images: [{ url: imageUrl, alt: title }] },
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

/** Prefer a complete, informative sentence for search snippets when one fits. */
export function clipDescription(text: string, max = 160): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;

  const withinLimit = normalized.slice(0, max);
  const sentenceEndPattern = /[.!?]["'”’)}\]]?(?=\s+[A-Z0-9])/g;
  const sentenceEnds = [...withinLimit.matchAll(sentenceEndPattern)];
  const lastSentence = sentenceEnds.at(-1);
  const sentenceEnd = lastSentence ? lastSentence.index! + lastSentence[0].length : 0;
  if (sentenceEnd >= Math.ceil(max * 0.3)) return normalized.slice(0, sentenceEnd).trim();

  // A useful sentence may run slightly past the usual snippet length. Google
  // truncates snippets to fit the result anyway, so keep that sentence intact.
  const extendedLimit = Math.min(normalized.length, max + 40);
  const extendedEnds = [...normalized.slice(0, extendedLimit).matchAll(sentenceEndPattern)];
  const extendedSentence = extendedEnds.find((match) => match.index! + match[0].length > max);
  if (extendedSentence) {
    return normalized.slice(0, extendedSentence.index! + extendedSentence[0].length).trim();
  }

  return clip(normalized, max);
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
export function faqPage(items: readonly { question: string; answer: string }[]): Record<string, unknown> {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
