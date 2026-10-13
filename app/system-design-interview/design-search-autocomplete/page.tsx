import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/page-header";
import { breadcrumbs, faqPage, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_URL } from "@/lib/site";

const PATH = "/system-design-interview/design-search-autocomplete";
const TITLE = "Search Autocomplete System Design Interview: Typeahead";
const DESCRIPTION =
  "A worked system design interview guide for search autocomplete. Estimate typeahead traffic, compare prefix indexes, rank suggestions, and handle stale or sensitive queries.";
const MODIFIED = "2026-10-13";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "How do you design search autocomplete in a system design interview?",
    answer:
      "Clarify whether suggestions complete a prefix or search across terms, set latency and freshness targets, then estimate requests from users and keystrokes. Build a bounded prefix index, rank candidates using recent and long-term popularity, cache common prefixes, and state how you suppress sensitive or abusive suggestions.",
  },
  {
    question: "Should autocomplete use a trie or a search engine?",
    answer:
      "It depends on the query and update needs. A trie or finite-state transducer can serve prefix lookups from a compact in-memory structure. A search engine with edge n-grams or a search-as-you-type field supports richer matching at the cost of more index work and storage. Compare these choices against the required matching, ranking, and freshness behavior.",
  },
  {
    question: "How should autocomplete rank suggestions?",
    answer:
      "Use a small, explainable score based on recent and long-term popularity, with freshness or editorial adjustments only where the product needs them. Apply locale and policy filters before returning results. Keep the score components measurable so the team can change them without rebuilding the query path.",
  },
  {
    question: "How do you protect privacy in autocomplete?",
    answer:
      "Avoid storing a person's typed prefix with their identity unless personalization is a stated requirement. Aggregate query counts, suppress low-volume or sensitive phrases, limit retention of raw queries, and filter unsafe or abusive suggestions before they reach the index.",
  },
];

export default function DesignSearchAutocompletePage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "System design interview guide", path: "/system-design-interview" },
                { name: "Search autocomplete system design", path: PATH },
              ]),
              {
                "@type": "Article",
                headline: TITLE,
                description: DESCRIPTION,
                url: SITE_URL + PATH,
                mainEntityOfPage: SITE_URL + PATH,
                datePublished: MODIFIED,
                dateModified: MODIFIED,
                inLanguage: "en",
                author: { "@id": SITE_URL + "/#organization" },
                publisher: { "@id": SITE_URL + "/#organization" },
                about: ["Search autocomplete", "Typeahead", "System design interview"],
              },
              faqPage(FAQ),
            ],
          }),
        }}
      />

      <PageHeader title="Search autocomplete system design interview: a worked guide" meta="Updated October 13, 2026">
        Design typeahead suggestions for a search box. The central choices are what counts as a match, how to rank a
        small candidate set, how often to refresh it, and what query data is safe to retain. This is an interview
        proposal with illustrative assumptions, not a description of a search company&apos;s private architecture.
      </PageHeader>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/system-design-interview" className="btn btn-accent">
          Follow the 45-minute interview plan
        </Link>
        <Link href="/capacity-estimator" className="btn btn-secondary">
          Estimate QPS and storage
        </Link>
      </div>

      <Section id="clarify" title="Clarify what autocomplete must return">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            Ask whether the box completes a prefix, searches for terms that contain the input, or suggests full queries.
            Prefix completion is a narrower problem than general search. For this design, assume a public product-search
            box that returns up to eight query suggestions after the user types two characters. Results are scoped to a
            locale, with no personal history or account-specific ranking.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Return useful suggestions before the user submits a search.</li>
            <li>Keep the response within an agreed interactive latency target, such as 100 ms at p95.</li>
            <li>Reflect new, removed, or blocked suggestions within a stated freshness window.</li>
            <li>Do not expose a rare or sensitive query because one person typed it.</li>
          </ul>
          <p>
            Treat the latency and freshness numbers as interview assumptions. Ask the interviewer to change them before
            choosing a storage or update strategy.
          </p>
        </div>
      </Section>

      <Section id="estimate" title="Estimate requests from typing">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            Suppose 10 million people search each day, each makes eight searches, and the client sends five eligible
            prefixes per search. That gives 400 million suggestion requests per day, or about 4,600 requests per second
            on average. If peak traffic is five times the average, size the read path for about 23,000 requests per
            second. These are round interview inputs, not measured product traffic.
          </p>
          <p>
            The result explains why the client should debounce keystrokes and stop requests for prefixes that are too
            short. It also gives a starting point for cache sizing. Next, ask how many distinct suggestions exist, how
            many are active in each locale, and how quickly popularity changes. Those answers drive index size and
            refresh work.
          </p>
        </div>
      </Section>

      <Section id="architecture" title="Separate query serving from suggestion building">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            Keep typing requests off the pipeline that learns which suggestions are useful. The online path reads a
            versioned index. A separate batch or streaming pipeline validates candidate phrases, updates scores, and
            publishes a new index snapshot.
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>The browser normalizes the prefix, waits briefly for typing to pause, and sends the locale.</li>
            <li>An edge or API layer checks request size, rate limits callers, and checks a cache for the prefix.</li>
            <li>A suggestion service reads matching candidates from the locale&apos;s prefix index.</li>
            <li>The ranker filters blocked candidates, orders the remaining suggestions, and returns at most eight.</li>
            <li>A separate pipeline aggregates approved query activity and publishes index versions.</li>
          </ol>
          <p>
            Cache by normalized prefix and locale. A short expiration keeps common prefixes cheap to serve, while index
            versioning lets every region switch to a complete snapshot instead of seeing a half-written update.
          </p>
        </div>
      </Section>

      <Section id="index" title="Choose the index for the matching rules">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            A trie or finite-state transducer fits exact prefix completion. It can keep a compact, read-optimized map
            from a prefix to likely completions. The serving path is predictable, but ranking, frequent updates, and
            multi-locale data need a deliberate design.
          </p>
          <p>
            An inverted search index with edge n-grams or a search-as-you-type field fits richer matching, such as
            matching a prefix at the start of each word. It shifts more work to indexing and uses more index space.
            OpenSearch documents prefix matching, edge n-grams, search-as-you-type, and completion suggesters as
            separate approaches. Its completion suggester stores suggestions in a finite-state structure for prefix
            lookup. Read the{" "}
            <a className="link" href="https://docs.opensearch.org/latest/search-plugins/searching-data/autocomplete/">
              OpenSearch autocomplete guide
            </a>
            .
          </p>
          <p>
            Redis sorted sets can also support a lexicographic prefix range when members share the same score. That
            gives a simple index for a bounded suggestion set, but returning candidates in popularity order requires a
            second ranking step. See the{" "}
            <a className="link" href="https://redis.io/docs/latest/develop/clients/patterns/indexes/">
              Redis lexicographical index pattern
            </a>
            .
          </p>
          <p>
            Start with a completion structure if the requirement is prefix-only and the candidate set is curated. Add
            an inverted index only if the prompt needs infix matching, typo tolerance, or richer filters. Do not choose
            a search cluster just because the feature contains the word search.
          </p>
        </div>
      </Section>

      <Section id="ranking" title="Rank candidates without hiding the trade-off">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            A simple score can combine recent query count and longer-term count. For example, use a weighted sum of the
            logarithms of each count, then apply explicit boosts for freshness and penalties for stale or low-quality
            phrases. The logarithm prevents a single extremely popular phrase from crowding out every alternative.
          </p>
          <p>
            Normalize accents and case for matching, but keep the display text users expect. Filter by locale, policy,
            and product availability before ranking. If you add personalization, define its data source and deletion
            behavior separately. The base design should still work without it.
          </p>
          <p>
            A daily batch update is simpler and makes the index easy to publish atomically. A streaming update reflects
            new trends sooner, but it adds ordering, deduplication, and rollback concerns. Choose the freshness target
            first. Keep a previous index snapshot available so a bad update can be rolled back.
          </p>
        </div>
      </Section>

      <Section id="privacy" title="Keep private and abusive queries out">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            A query typed by one person is not automatically a good suggestion for everyone. Aggregate counts before
            building the shared index, apply a minimum-volume threshold, and suppress phrases that may expose personal
            or sensitive information. Keep raw query retention short and separate it from account identity. The
            product&apos;s privacy policy should say what the pipeline stores.
          </p>
          <p>
            Add a moderation path for slurs, spam, impersonation, and queries that point to unavailable products. A
            removal should invalidate cached results as well as the source index. Rate limits and a maximum prefix
            length also limit abuse and prevent large range scans.
          </p>
        </div>
      </Section>

      <Section id="failures" title="Explain what happens when the index fails">
        <dl className="max-w-[72ch] divide-y divide-rule border-y border-rule text-[0.9375rem]">
          {[
            ["The latest index is malformed", "Keep serving the previous verified snapshot and stop promotion."],
            ["A region loses its index", "Use a local cached snapshot or route to a healthy region. Search still works without suggestions."],
            ["A prefix is unusually popular", "Serve it from cache, enforce request limits, and bound the number of candidates examined."],
            ["A suggestion must be removed", "Publish a tombstone or denylist update, purge matching cache entries, and verify each region applied it."],
            ["Popularity data is delayed", "Keep serving the last good ranking. Do not block typing on the aggregation pipeline."],
          ].map(([failure, response]) => (
            <div key={failure} className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[15rem_minmax(0,1fr)]">
              <dt className="font-medium">{failure}</dt>
              <dd className="leading-relaxed text-ink-2">{response}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="practice" title="Practice the connected interview skills">
        <div className="max-w-[72ch] space-y-3 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            Use the <Link href="/concepts/caching" className="link">caching guide</Link> to reason about hot prefixes
            and stale results. Use the <Link href="/concepts/rate-limiting" className="link">rate limiting guide</Link>{" "}
            to protect the API. Then run a timed{" "}
            <Link href="/system-design-mock-interview" className="link">system design mock interview</Link> and
            explain why the matching method fits the prompt.
          </p>
          <p>
            This walkthrough is original practice material. Its example targets and architecture choices are
            assumptions to discuss in an interview, not claims about a named company&apos;s production system.
          </p>
        </div>
      </Section>

      <Section id="questions" title="Common follow-up questions">
        <dl className="max-w-[72ch] divide-y divide-rule border-y border-rule text-[0.9375rem]">
          {FAQ.map((item) => (
            <div key={item.question} className="py-4">
              <dt className="font-medium">{item.question}</dt>
              <dd className="mt-1 leading-relaxed text-ink-2">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </article>
  );
}
