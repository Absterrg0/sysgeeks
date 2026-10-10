import type { Metadata } from "next";
import Link from "next/link";
import { InvestigationIndex } from "@/components/investigation/investigation-index";
import { PageHeader } from "@/components/page-header";
import { getInvestigation, listInvestigations } from "@/lib/content";
import { itemList, jsonLd, pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "System Design Interview Questions and Answers",
  description:
    "Practice system design interview questions with worked, interactive answers. Design a URL shortener, rate limiter, news feed, payment system, job queue and more.",
  path: "/investigations",
});

const PRACTICE_PATH = [
  {
    id: "url-shortener",
    answer:
      "Generate a unique key, store its mapping to the long URL durably, and keep redirects fast with a cache for popular keys. Record click analytics asynchronously so tracking does not slow the redirect path.",
    focus: "Estimate a read-heavy workload, then decide what to cache and how to count clicks without slowing redirects.",
  },
  {
    id: "api-rate-limiter",
    answer:
      "A token bucket handles bursts while enforcing an average refill rate. A strict global limit needs shared state across servers; local counters are more available but can temporarily exceed the intended limit.",
    focus: "Compare counter and token-bucket designs, then decide how multiple servers share limits.",
  },
  {
    id: "news-feed",
    answer:
      "Build most feeds by writing new posts into followers’ timelines, then fetch posts on read for very large publishers. A hybrid avoids making celebrity posts fan out to millions of inboxes while keeping ordinary reads fast.",
    focus: "Choose between write fan-out and read fan-out when a few accounts have millions of followers.",
  },
  {
    id: "payment-workflow",
    answer:
      "Give each payment attempt a durable idempotency key and move it through an explicit state machine. Retries can then return the existing result, while provider events are deduplicated and reconciled instead of assuming exactly-once delivery.",
    focus: "Make retries safe when a payment succeeds but the caller never receives the response.",
  },
  {
    id: "job-queue",
    answer:
      "Assume at-least-once delivery: acknowledge work only after its effect is durable, make handlers idempotent, and use expiring leases so another worker can recover a crashed job. Bound retries and route repeatedly failing jobs to a dead-letter queue.",
    focus: "Handle duplicate delivery, worker crashes, retries and messages that can never succeed.",
  },
] as const;

export default function InvestigationsPage() {
  const investigations = listInvestigations();
  const practicePath = PRACTICE_PATH.flatMap(({ id, focus, answer }) => {
    const investigation = getInvestigation(id);
    return investigation ? [{ investigation, focus, answer }] : [];
  });
  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            itemList(
              "System design interview questions and worked answers",
              investigations.map((inv) => ({ name: inv.searchTitle, path: `/investigations/${inv.id}` })),
            ),
          ),
        }}
      />
      <PageHeader title="System design interview questions and answers">
        Practice each question as a full interview exercise. Set requirements, estimate capacity, make the design
        decisions, then test failures and changed constraints before comparing your reasoning with the worked answer.
        New to the format? Start with{" "}
        <Link href="/system-design-interview" className="link">
          how the interview works
        </Link>
        .
      </PageHeader>
      <section aria-labelledby="practice-path" className="mt-8 max-w-[72ch]">
        <h2 id="practice-path" className="font-display text-[1.375rem] leading-tight tracking-[-0.015em]">
          Five system design interview questions with short answers
        </h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
          These summaries show the key design choice and its cost; the full answer depends on the requirements and
          scale you agree on in the interview. Use each one as a starting point, then work through the linked exercise
          before reading its complete walkthrough.
        </p>
        <ol className="mt-5 divide-y divide-rule border-y border-rule">
          {practicePath.map(({ investigation, focus, answer }) => (
            <li key={investigation.id} className="py-3.5">
              <Link
                href={`/investigations/${investigation.id}`}
                className="font-medium transition-colors hover:text-accent"
              >
                {investigation.searchTitle}
              </Link>
              <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
                <strong className="font-medium text-ink">Short answer: </strong>
                {answer}
              </p>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-3">
                Practise: {focus}{" "}
                <Link href={`/investigations/${investigation.id}/review`} className="font-medium text-accent hover:underline">
                  Read the full worked answer →
                </Link>
              </p>
            </li>
          ))}
        </ol>
      </section>
      <section aria-label="All investigations" className="pt-8 pb-10">
        <InvestigationIndex investigations={investigations} grouped />
      </section>
      <section aria-labelledby="youtube-walkthrough" className="max-w-[66ch] border-t border-rule py-8">
        <h2 id="youtube-walkthrough" className="font-display text-[1.25rem] leading-tight">
          Design YouTube: a video streaming system design answer
        </h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
          Work through the upload path, transcoding pipeline, adaptive playback, CDN caching and failure cases in a
          separate interview walkthrough.
        </p>
        <Link href="/system-design-interview/design-youtube" className="mt-3 inline-block text-[0.875rem] font-medium text-accent hover:underline">
          Read the YouTube system design walkthrough →
        </Link>
      </section>
    </div>
  );
}
