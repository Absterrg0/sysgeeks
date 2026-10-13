import type { Metadata } from "next";
import Link from "next/link";
import { ContentUsefulness } from "@/components/content-usefulness";
import { PracticeEntryLink } from "@/components/practice-entry-link";
import { DIFFICULTY } from "@/components/investigation/difficulty";
import { PageHeader } from "@/components/page-header";
import { ShareButton } from "@/components/share";
import { TrackedDownloadLink } from "@/components/tracked-download-link";
import { getInvestigation } from "@/lib/content";
import SYSTEM_DESIGN_ANSWERS from "@/lib/content/system-design-answers.json";
import { SYSTEM_DESIGN_FUNDAMENTALS } from "@/lib/content/system-design-fundamentals";
import { breadcrumbs, faqPage, itemList, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const TOTAL_QUESTION_COUNT = SYSTEM_DESIGN_ANSWERS.length + SYSTEM_DESIGN_FUNDAMENTALS.length;
const TITLE = `${TOTAL_QUESTION_COUNT} System Design Interview Questions & Answers`;
const DESCRIPTION = `Practice ${SYSTEM_DESIGN_ANSWERS.length} system design prompts interactively, then review ${SYSTEM_DESIGN_FUNDAMENTALS.length} fundamentals with direct answers. Free, no signup; PDF included.`;
const PDF_PATH = "/downloads/system-design-interview-questions-and-answers.pdf";

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/investigations",
});

const PRACTICE_PATH = SYSTEM_DESIGN_ANSWERS;

export default function InvestigationsPage() {
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
                    `${SYSTEM_DESIGN_ANSWERS.length} full system design interview problems and worked answers`,
                    PRACTICE_PATH.map(({ id, title }) => ({ name: title, path: `/investigations/${id}/review` })),
                  ),
                  hasPart: {
                    "@type": "DigitalDocument",
                    name: `${TOTAL_QUESTION_COUNT} system design interview questions and answers (PDF)`,
                    encodingFormat: "application/pdf",
                    contentUrl: `${SITE_URL}${PDF_PATH}`,
                    inLanguage: "en",
                    isAccessibleForFree: true,
                    publisher: { "@id": `${SITE_URL}/#organization` },
                  },
                },
                faqPage(SYSTEM_DESIGN_FUNDAMENTALS.map(({ question, answer }) => ({ question, answer }))),
              ],
            },
          ),
        }}
      />
      <PageHeader
        title={`${TOTAL_QUESTION_COUNT} system design interview questions and answers`}
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
              title={`${TOTAL_QUESTION_COUNT} System Design Interview Questions · ${SITE_NAME}`}
              text={`Explore ${TOTAL_QUESTION_COUNT} free system design interview questions and answers: ${questionCount} interactive designs plus ${SYSTEM_DESIGN_FUNDAMENTALS.length} fundamentals.`}
            />
          </>
        }
      >
        Practise {questionCount} questions as full interview exercises. Set requirements, estimate capacity, make the
        design decisions, then test failures and changed constraints before comparing your reasoning with the worked
        answer. Review {SYSTEM_DESIGN_FUNDAMENTALS.length} common fundamentals with direct answers below. New to the format? Start with{" "}
        <Link href="/system-design-interview" className="link">
          how the interview works
        </Link>
        .
      </PageHeader>
      <section aria-labelledby="question-bank" className="mt-8 max-w-[72ch]">
        <h2 id="question-bank" className="font-display text-[1.375rem] leading-tight tracking-[-0.015em]">
          {TOTAL_QUESTION_COUNT} system design interview questions with answers
        </h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
          Work through {SYSTEM_DESIGN_ANSWERS.length} interactive design problems with short answers and full worked
          exercises, then review {SYSTEM_DESIGN_FUNDAMENTALS.length} core system design fundamentals with direct answers.
        </p>
        <section aria-labelledby="practice-path" className="mt-8">
          <h3 id="practice-path" className="font-display text-[1.125rem] leading-tight tracking-[-0.015em]">
            {PRACTICE_PATH.length} system design problems with short answers
          </h3>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
            These summaries show the key design choice and its cost; the full answer depends on the requirements and
            scale you agree on in the interview. Use each one as a starting point, then work through the linked exercise
            before reading its complete walkthrough.
          </p>
          <div className="mt-5 space-y-8">
            {levels.map(({ level, items }) =>
              items.length === 0 ? null : (
                <section key={level} aria-labelledby={`questions-${level}`}>
                  <h4 id={`questions-${level}`} className="mb-2 flex items-baseline gap-2 text-[0.875rem] font-semibold">
                    {DIFFICULTY[level]} questions
                    <span className="font-mono text-[0.6875rem] font-normal text-ink-3">{items.length}</span>
                  </h4>
                  <ol className="divide-y divide-rule border-y border-rule">
                    {items.map(({ investigation, title, focus, answer }) => (
                      <li key={investigation.id} className="py-3.5">
                        <h5 className="text-[0.9375rem] font-medium">
                          <PracticeEntryLink
                            href={`/investigations/${investigation.id}`}
                            investigationId={investigation.id}
                            source="question_catalog"
                            className="transition-colors hover:text-accent"
                          >
                            {title}
                          </PracticeEntryLink>
                        </h5>
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
              Download all {TOTAL_QUESTION_COUNT} questions and answers (PDF)
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
        <section aria-labelledby="fundamentals" className="mt-8 max-w-[66ch] border-t border-rule py-8">
          <h3 id="fundamentals" className="font-display text-[1.125rem] leading-tight">
            {SYSTEM_DESIGN_FUNDAMENTALS.length} system design fundamentals with direct answers
          </h3>
          <dl className="mt-3 divide-y divide-rule border-y border-rule">
            {SYSTEM_DESIGN_FUNDAMENTALS.map(({ question, answer, links }) => (
              <div key={question} className="py-4">
                <dt className="text-[0.9375rem] font-medium">{question}</dt>
                <dd className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
                  {answer} Read more: {links.map((link, index) => (
                    <span key={link.href}>
                      {index > 0 ? ", " : ""}
                      <Link href={link.href} className="link">{link.label}</Link>
                    </span>
                  ))}.
                </dd>
              </div>
            ))}
          </dl>
        </section>
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
              <Link href="/system-design-interview/design-whatsapp" className="transition-colors hover:text-accent">
                Design WhatsApp: a secure chat system
              </Link>
            </h3>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">
              Trace encrypted messages through persistent connections, offline queues, delivery acknowledgements and
              multi-device fan-out.
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
