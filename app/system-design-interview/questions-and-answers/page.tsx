import type { Metadata } from "next";
import Link from "next/link";
import { breadcrumbs, itemList, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const PATH = "/system-design-interview/questions-and-answers";
const PDF_PATH = "/downloads/system-design-interview-questions-and-answers.pdf";
const TITLE = "15 System Design Interview Questions and Answers";
const DESCRIPTION =
  "Practice 15 system design interview questions with concise answer outlines, follow-up prompts and full walkthroughs. Download the free PDF. No signup.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const QUESTIONS = [
  {
    title: "Design a URL shortener",
    id: "url-shortener",
    answer:
      "Generate a unique key and store its mapping to the long URL durably. Cache popular mappings to keep redirects fast, and record click analytics asynchronously so tracking does not delay the redirect.",
    focus: "Estimate a read-heavy workload, then decide what to cache and how to count clicks without slowing redirects.",
  },
  {
    title: "Design an API rate limiter",
    id: "api-rate-limiter",
    answer:
      "A token bucket allows short bursts while enforcing an average refill rate. A strict global limit needs shared state across servers; local counters improve availability but can temporarily exceed the limit.",
    focus: "Compare counter and token-bucket designs, then decide how multiple servers share limits.",
  },
  {
    title: "Design a news feed",
    id: "news-feed",
    answer:
      "Write new posts into most followers' timelines, then fetch posts on read for very large publishers. This hybrid avoids fanning a celebrity's posts out to millions of inboxes while keeping ordinary reads fast.",
    focus: "Choose between write fan-out and read fan-out when a few accounts have millions of followers.",
  },
  {
    title: "Design an Uber-style ride-sharing system",
    id: "ride-dispatch",
    answer:
      "Use a short-lived spatial index to find fresh, available drivers near a pickup, then rank a smaller candidate set by road ETA. Reserve the driver and ride with a conditional, versioned state change before sending an offer; leases and idempotent replies make retries safe.",
    focus: "Match nearby drivers without stale locations or duplicate assignments, then isolate a stadium hotspot.",
  },
  {
    title: "Design a payment system",
    id: "payment-workflow",
    answer:
      "Give each payment attempt a durable idempotency key and move it through an explicit state machine. Retries can return the existing result, while provider events are deduplicated and reconciled instead of assuming exactly-once delivery.",
    focus: "Make retries safe when a payment succeeds but the caller never receives the response.",
  },
  {
    title: "Design a distributed job queue",
    id: "job-queue",
    answer:
      "Assume at-least-once delivery. Acknowledge work only after its effect is durable, make handlers idempotent, and use expiring leases to recover jobs from crashed workers. Bound retries and move repeatedly failing jobs to a dead-letter queue.",
    focus: "Handle duplicate delivery, worker crashes, retries, and messages that cannot succeed.",
  },
  {
    title: "Design a video processing pipeline",
    id: "video-processing-pipeline",
    answer:
      "Upload video bytes directly and resumably to object storage. Track each video and transcode job in a durable state machine; workers use expiring, fenced leases and attempt-specific outputs so a retry cannot let stale work overwrite the current result.",
    focus: "Separate upload, durable job state, and transcoding so each can recover independently.",
  },
  {
    title: "Design a Dropbox-style file sync service",
    id: "file-storage-sync",
    answer:
      "Split files into verified immutable blocks and publish versions through conditional metadata manifests. Devices resume from an ordered change journal; preserve concurrent offline edits as conflict copies, check current permissions before block reads, and delay garbage collection of unreferenced blocks.",
    focus: "Keep large uploads resumable and file versions complete through reconnects, conflicts, access changes, and restores.",
  },
  {
    title: "Design a product analytics system",
    id: "product-analytics",
    answer:
      "Append validated events to a durable stream before acknowledging them, then batch events into a column store for queries by team, event, and time. Stable event IDs make retries safe; an identity override table supports anonymous-to-known user merges without rewriting event history.",
    focus: "Keep ingestion durable and deduplicated while making time-range queries fast for each customer.",
  },
  {
    title: "Design a notification system",
    id: "notification-system",
    answer:
      "Write product events through an outbox, then create notifications with stable deduplication keys. Delivery workers claim notifications through a state machine, recheck current preferences before sending, and separate critical traffic from bulk traffic. Retries must handle providers that accept a message before timing out.",
    focus: "Prevent duplicate sends, honor preference changes, and protect urgent messages when a provider slows down.",
  },
  {
    title: "Design a distributed cache",
    id: "distributed-cache",
    answer:
      "Keep the database authoritative and treat the cache as a disposable, demand-filled copy. Record invalidations with each database commit and deliver them after replication; use leases to stop an old read from restoring stale data, and keep spare capacity for a cache-node failure.",
    focus: "Control stale reads and database load during writes, hot-key bursts, and cache failures.",
  },
  {
    title: "Design Discord's message storage",
    id: "chat-message-store",
    answer:
      "Partition messages by channel and time bucket, then order them with time-sortable IDs so recent pages and history reads touch a small range. Route each channel's reads locally and coalesce identical requests; use tombstones, repair, and dual writes to make deletes and live database moves explicit.",
    focus: "Keep channel history cheap to read while managing hot channels and database migrations.",
  },
  {
    title: "Design a collaborative editor like Google Docs",
    id: "realtime-collaboration",
    answer:
      "Give each document one fenced owner to assign durable sequence numbers. Clients apply edits locally and resend unacknowledged operations after reconnecting; an operation-merge algorithm makes concurrent edits converge, while transient presence stays separate from the durable edit log.",
    focus: "Preserve document history through concurrent edits, reconnects, owner changes, and fan-out.",
  },
  {
    title: "Design a reactive database with live queries",
    id: "live-queries",
    answer:
      "Run each query at a versioned snapshot and record the index ranges it reads. When a commit changes a range, rerun only affected queries and push results with the commit timestamp; clients apply updates only when subscriptions agree on that timestamp.",
    focus: "Update subscribed query results without polling or combining data from different snapshots.",
  },
  {
    title: "Shard a live database without downtime",
    id: "shard-live-database",
    answer:
      "Shard by workspace when most reads and joins stay within one workspace, and map a fixed set of logical shards to database hosts. During migration, log writes, backfill versioned rows, catch up, verify with comparisons and dark reads, then cut over in a reversible way.",
    focus: "Scale write volume without rehashing every row, and migrate live data without losing newer writes.",
  },
] as const;

export default function SystemDesignQuestionsAndAnswersPage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "System design interview guide", path: "/system-design-interview" },
                { name: "Questions and answers", path: PATH },
              ]),
              {
                "@type": "Article",
                headline: TITLE,
                description: DESCRIPTION,
                url: `${SITE_URL}${PATH}`,
                mainEntityOfPage: `${SITE_URL}${PATH}`,
                inLanguage: "en",
                author: { "@id": `${SITE_URL}/#organization` },
                publisher: { "@id": `${SITE_URL}/#organization` },
                mainEntity: itemList(
                  "15 system design interview questions with answer outlines",
                  QUESTIONS.map((question) => ({
                    name: question.title,
                    path: `/investigations/${question.id}/review`,
                  })),
                ),
              },
              {
                "@type": "DigitalDocument",
                name: TITLE,
                encodingFormat: "application/pdf",
                contentUrl: `${SITE_URL}${PDF_PATH}`,
                inLanguage: "en",
                isAccessibleForFree: true,
                publisher: { "@id": `${SITE_URL}/#organization` },
              },
            ],
          }),
        }}
      />

      <header className="border-b border-rule pt-8 pb-6 sm:pt-10">
        <p className="mb-2 text-[0.8125rem] text-ink-3">
          <Link href="/system-design-interview" className="hover:text-ink">
            System design interview guide
          </Link>
          <span className="mx-1.5 text-rule-strong">/</span>Questions and answers
        </p>
        <h1 className="font-display text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-balance sm:text-[2rem]">
          15 system design interview questions and answers
        </h1>
        <p className="mt-2.5 max-w-[66ch] text-[0.9375rem] leading-relaxed text-ink-2">
          Use these concise answer outlines to practise common system design problems. Each one links to an interactive
          exercise and a full worked answer. The prompts are original practice material, not reports of questions asked
          by the named companies or products.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a className="btn btn-accent" href={PDF_PATH} download>
            Download the free 3-page PDF
          </a>
          <Link className="btn btn-secondary" href="/investigations">
            Browse all practice systems
          </Link>
        </div>
        <p className="mt-3 text-[0.8125rem] text-ink-3">Free to read and download. No account or email required.</p>
      </header>

      <section aria-labelledby="questions" className="section">
        <h2 id="questions" className="font-display text-[1.375rem] leading-tight tracking-[-0.015em]">
          Questions with concise answer outlines
        </h2>
        <ol className="mt-5 divide-y divide-rule border-y border-rule">
          {QUESTIONS.map((question, index) => (
            <li key={question.id} className="py-5">
              <p className="text-[0.75rem] font-medium text-ink-3">Question {index + 1}</p>
              <h3 className="mt-1 text-[1rem] font-medium">{question.title}</h3>
              <p className="mt-2 max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
                <span className="font-medium text-ink">Answer outline. </span>{question.answer}
              </p>
              <p className="mt-2 max-w-[72ch] text-[0.875rem] leading-relaxed text-ink-3">
                <span className="font-medium text-ink-2">Practice focus. </span>{question.focus}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.8125rem] font-medium">
                <Link href={`/investigations/${question.id}`} className="text-accent hover:underline">
                  Try the interactive question →
                </Link>
                <Link href={`/investigations/${question.id}/review`} className="text-ink-3 hover:text-ink hover:underline">
                  Read the full worked answer
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="practice" className="section border-t border-rule">
        <h2 id="practice" className="font-display text-[1.375rem] leading-tight tracking-[-0.015em]">
          How to use the answers in a practice round
        </h2>
        <ol className="mt-4 max-w-[66ch] list-decimal space-y-2 pl-5 text-[0.9375rem] leading-relaxed text-ink-2">
          <li>Choose a prompt and clarify its requirements before drawing components.</li>
          <li>Estimate traffic or storage, then use the numbers to choose where to spend time.</li>
          <li>Explain one design choice, one failure, and the trade-off you accept.</li>
          <li>Compare your reasoning with the worked answer and choose one weak area to practise again.</li>
        </ol>
        <p className="mt-4 max-w-[66ch] text-[0.9375rem] leading-relaxed text-ink-2">
          For a timed solo round, use the <Link href="/system-design-mock-interview" className="link">system design mock interview practice</Link>.
          For a short printable plan, download the <Link href="/system-design-interview/worksheet" className="link">system design interview cheat sheet</Link>.
        </p>
      </section>

      <p className="section border-t border-rule text-[0.8125rem] text-ink-3">
        Published by {SITE_NAME}. The outlines are starting points; a sound design depends on the requirements and scale in the prompt.
      </p>
    </article>
  );
}
