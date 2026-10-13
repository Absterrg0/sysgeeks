import type { Metadata } from "next";
import Link from "next/link";
import { ContentUsefulness } from "@/components/content-usefulness";
import { PracticeEntryLink } from "@/components/practice-entry-link";
import { DIFFICULTY } from "@/components/investigation/difficulty";
import { PageHeader } from "@/components/page-header";
import { ShareButton } from "@/components/share";
import { TrackedDownloadLink } from "@/components/tracked-download-link";
import { getInvestigation, listInvestigations } from "@/lib/content";
import SYSTEM_DESIGN_ANSWERS from "@/lib/content/system-design-answers.json";
import { breadcrumbs, itemList, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const TITLE = `${SYSTEM_DESIGN_ANSWERS.length} Free Interactive System Design Interview Questions & Answers`;
const DESCRIPTION =
  `Practice ${SYSTEM_DESIGN_ANSWERS.length} system design interview questions as interactive exercises: make a design choice, test a failure, then compare with a worked answer. Free PDF; no signup.`;
const PDF_PATH = "/downloads/system-design-interview-questions-and-answers.pdf";

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/investigations",
});

const PRACTICE_PATH = SYSTEM_DESIGN_ANSWERS;

export default function InvestigationsPage() {
  const investigations = listInvestigations();
  const questionCount = PRACTICE_PATH.length;
  const practicePath = PRACTICE_PATH.flatMap(({ id, title, focus, answer }) => {
    const investigation = getInvestigation(id);
    return investigation ? [{ investigation, title, focus, answer }] : [];
  });
  const levels = (["foundational", "intermediate", "advanced"] as const).map((level) => ({
    level,
    items: practicePath.filter(({ investigation }) => investigation.difficulty === level),
  }));
  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            {
              "@graph": [
                breadcrumbs([{ name: "System design interview questions and answers", path: "/investigations" }]),
                {
                  "@type": "WebPage",
                  name: TITLE,
                  description: DESCRIPTION,
                  url: `${SITE_URL}/investigations`,
                  mainEntity: itemList(
                    "System design interview questions and worked answers",
                    PRACTICE_PATH.map(({ id, title }) => ({ name: title, path: `/investigations/${id}/review` })),
                  ),
                  hasPart: {
                    "@type": "DigitalDocument",
                    name: `${SYSTEM_DESIGN_ANSWERS.length} system design interview questions and answers (PDF)`,
                    encodingFormat: "application/pdf",
                    contentUrl: `${SITE_URL}${PDF_PATH}`,
                    inLanguage: "en",
                    isAccessibleForFree: true,
                    publisher: { "@id": `${SITE_URL}/#organization` },
                  },
                },
              ],
            },
          ),
        }}
      />
      <PageHeader
        title={`${questionCount} interactive system design interview questions, with worked answers`}
        actions={
          <>
            {PRACTICE_PATH[0] && (
              <PracticeEntryLink
                href={`/investigations/${PRACTICE_PATH[0].id}`}
                investigationId={PRACTICE_PATH[0].id}
                source="question_catalog"
                className="btn btn-accent"
              >
                Start a practice question
              </PracticeEntryLink>
            )}
            <ShareButton
              url={`${SITE_URL}/investigations`}
              title={`${questionCount} System Design Interview Questions · ${SITE_NAME}`}
              text={`Explore ${questionCount} free system design interview questions with interactive exercises and worked answers.`}
            />
          </>
        }
      >
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
          {PRACTICE_PATH.length} system design interview questions with short answers
        </h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
          These summaries show the key design choice and its cost; the full answer depends on the requirements and
          scale you agree on in the interview. Use each one as a starting point, then work through the linked exercise
          before reading its complete walkthrough.
        </p>
        <div className="mt-5 space-y-8">
          {levels.map(({ level, items }) =>
            items.length === 0 ? null : (
              <section key={level} aria-labelledby={`questions-${level}`}>
                <h3 id={`questions-${level}`} className="mb-2 flex items-baseline gap-2 text-[0.875rem] font-semibold">
                  {DIFFICULTY[level]} questions
                  <span className="font-mono text-[0.6875rem] font-normal text-ink-3">{items.length}</span>
                </h3>
                <ol className="divide-y divide-rule border-y border-rule">
                  {items.map(({ investigation, title, focus, answer }) => (
                    <li key={investigation.id} className="py-3.5">
                      <h4 className="text-[0.9375rem] font-medium">
                        <PracticeEntryLink
                          href={`/investigations/${investigation.id}`}
                          investigationId={investigation.id}
                          source="question_catalog"
                          className="transition-colors hover:text-accent"
                        >
                          {title}
                        </PracticeEntryLink>
                      </h4>
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
            ),
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <TrackedDownloadLink
            className="btn btn-secondary"
            href={PDF_PATH}
            resource="system_design_questions_answers"
          >
            Download all {questionCount} questions and answers (PDF)
          </TrackedDownloadLink>
          <PracticeEntryLink
            href="/system-design-playground"
            source="question_catalog_playground"
            className="btn btn-secondary"
          >
            Try interactive system design interview practice
          </PracticeEntryLink>
          <span className="text-[0.8125rem] text-ink-3">Free, no signup. Includes links to full walkthroughs.</span>
        </div>
      </section>
      <section aria-labelledby="fundamentals" className="max-w-[66ch] border-t border-rule py-8">
        <h2 id="fundamentals" className="font-display text-[1.25rem] leading-tight">
          Common system design interview fundamentals
        </h2>
        <dl className="mt-3 divide-y divide-rule border-y border-rule">
          <div className="py-4">
            <dt className="text-[0.9375rem] font-medium">What should you clarify first in a system design interview?</dt>
            <dd className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
              Identify the users and their core actions, then agree on scale, latency, availability, consistency and
              durability needs. Prioritize the requirements that change the architecture before drawing components.
              See the <Link href="/system-design-interview" className="link">interview approach</Link>.
            </dd>
          </div>
          <div className="py-4">
            <dt className="text-[0.9375rem] font-medium">How do you estimate capacity for a system design?</dt>
            <dd className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
              Estimate peak requests per second, data written per day, retention and concurrent work from the
              requirements. Use order-of-magnitude numbers to find likely bottlenecks, then size the parts that need
              different scaling strategies. Learn about <Link href="/concepts/backpressure" className="link">capacity and backpressure</Link>.
            </dd>
          </div>
          <div className="py-4">
            <dt className="text-[0.9375rem] font-medium">What is the difference between replication and sharding?</dt>
            <dd className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
              Replication keeps copies of the same data on multiple machines, which can improve read capacity and
              resilience. Sharding splits data across machines to spread storage and write load, but makes
              cross-shard operations harder. Read about <Link href="/concepts/replication" className="link">replication</Link> and{" "}
              <Link href="/concepts/partitioning" className="link">partitioning</Link>.
            </dd>
          </div>
          <div className="py-4">
            <dt className="text-[0.9375rem] font-medium">When should you add a cache?</dt>
            <dd className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
              Cache data when repeated reads are costly and the hit rate makes the cache faster than recomputing or
              querying the source. Decide how stale a value may be and how writes invalidate it; caching adds
              consistency and failure cases. See the <Link href="/concepts/caching" className="link">caching guide</Link>.
            </dd>
          </div>
          <div className="py-4">
            <dt className="text-[0.9375rem] font-medium">When does a message queue help?</dt>
            <dd className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
              A queue decouples a producer from slower consumers and can absorb short bursts, giving workers time to
              process jobs asynchronously. It does not fix sustained overload: bound the queue, define retry and
              rejection behavior, and make handlers safe to retry. See <Link href="/concepts/message-queues" className="link">message queues</Link>.
            </dd>
          </div>
        </dl>
      </section>
      <section aria-labelledby="focused-walkthroughs" className="max-w-[66ch] border-t border-rule py-8">
        <h2 id="focused-walkthroughs" className="font-display text-[1.25rem] leading-tight">
          More system design interview walkthroughs
        </h2>
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          <li className="py-4">
            <h3 className="text-[0.9375rem] font-medium">
              <Link href="/system-design-interview/design-instagram-feed" className="transition-colors hover:text-accent">
                Design an Instagram home feed
              </Link>
            </h3>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
              Separate followed posts from recommendations, cap celebrity fan-out, and rank candidates in stages.
            </p>
          </li>
          <li className="py-4">
            <h3 className="text-[0.9375rem] font-medium">
              <Link href="/system-design-interview/design-youtube" className="transition-colors hover:text-accent">
                Design YouTube: a video streaming system
              </Link>
            </h3>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
              Work through uploads, transcoding, adaptive playback, CDN caching and failure cases.
            </p>
          </li>
          <li className="py-4">
            <h3 className="text-[0.9375rem] font-medium">
              <Link href="/system-design-interview/design-llm-inference" className="transition-colors hover:text-accent">
                Design an LLM inference service
              </Link>
            </h3>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
              Estimate token throughput, control GPU admission, balance continuous batching with latency, and handle
              streaming failures.
            </p>
          </li>
          <li className="py-4">
            <h3 className="text-[0.9375rem] font-medium">
              <Link href="/system-design-interview/design-rag-system" className="transition-colors hover:text-accent">
                Design a RAG system
              </Link>
            </h3>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
              Design private-document ingestion and retrieval with access controls, citations, freshness, and evaluation.
            </p>
          </li>
          <li className="py-4">
            <h3 className="text-[0.9375rem] font-medium">
              <Link href="/system-design-interview/design-ai-agent" className="transition-colors hover:text-accent">
                Design an AI agent
              </Link>
            </h3>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
              Work through scoped tools, safe external actions, idempotency, prompt injection, and evaluation.
            </p>
          </li>
        </ul>
      </section>
      <ContentUsefulness />
    </div>
  );
}
